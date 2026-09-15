const https = require('https');

// Funzione per fare fetch HTTPS senza dipendenze esterne
function httpsPost(url, data, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const body = JSON.stringify(data);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: headers || {}
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Crea embedding con OpenAI
async function creaEmbedding(testo) {
  const res = await httpsPost(
    'https://api.openai.com/v1/embeddings',
    { input: testo, model: 'text-embedding-3-small' },
    { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
  );
  if (res.body.data && res.body.data[0]) {
    return res.body.data[0].embedding;
  }
  throw new Error('Embedding fallito: ' + JSON.stringify(res.body));
}

// Cerca in Pinecone
async function cercaPinecone(embedding, topK = 5) {
  const indexHost = process.env.PINECONE_INDEX_HOST; // es. https://coach-app-knowledge-xxxx.svc.xxx.pinecone.io
  const res = await httpsPost(
    `${indexHost}/query`,
    { vector: embedding, topK, includeMetadata: true },
    { 'Api-Key': process.env.PINECONE_API_KEY }
  );
  return res.body.matches || [];
}

// Cerca su Tavily (fallback web)
async function cercaTavily(domanda) {
  const res = await httpsPost(
    'https://api.tavily.com/search',
    {
      api_key: process.env.TAVILY_API_KEY,
      query: domanda,
      search_depth: 'basic',
      max_results: 3
    },
    {}
  );
  if (res.body.results) {
    return res.body.results.map(r => r.content).join('\n\n');
  }
  return '';
}

// Costruisce il contesto dalla knowledge base con diversità forzata
function costruisciContesto(matches, sogliaMinima = 0.5) {
  const rilevanti = matches.filter(m => m.score >= sogliaMinima);
  if (rilevanti.length === 0) return null;

  // Diversità: max 2 chunk per fonte
  const perFonte = {};
  const diversi = [];
  for (const m of rilevanti) {
    const fonte = m.metadata?.fonte || 'unknown';
    if (!perFonte[fonte]) perFonte[fonte] = 0;
    if (perFonte[fonte] < 2) {
      diversi.push(m);
      perFonte[fonte]++;
    }
    if (diversi.length >= 5) break; // max 5 chunk totali
  }

  return diversi.map(m => {
    const fonte = m.metadata?.fonte || 'knowledge base';
    const testo = m.metadata?.testo || '';
    return `[Fonte: ${fonte}]\n${testo}`;
  }).join('\n\n---\n\n');
}

exports.handler = async (event) => {
  // Gestione CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    const body = JSON.parse(event.body);
    const messages = body.messages || [];
    const useRAG = body.useRAG !== false; // default true

    let contextoPrepend = '';

    // RAG — solo se richiesto e se Pinecone è configurato
    if (useRAG && process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX_HOST && process.env.OPENAI_API_KEY) {
      try {
        // Estrai l'ultima domanda dell'utente
        const ultimoMessaggio = messages.filter(m => m.role === 'user').pop();
        const domanda = typeof ultimoMessaggio?.content === 'string'
          ? ultimoMessaggio.content
          : ultimoMessaggio?.content?.find(c => c.type === 'text')?.text || '';

        if (domanda && domanda.length > 10) {
          // Crea embedding della domanda
          const embedding = await creaEmbedding(domanda);

          // Cerca in Pinecone con topK alto per poi filtrare per diversità
          const matches = await cercaPinecone(embedding, 10);
          const contesto = costruisciContesto(matches, 0.5);

          if (contesto) {
            // Knowledge base trovata — usa come contesto
            contextoPrepend = `KNOWLEDGE BASE RILEVANTE:\n${contesto}\n\nUSA queste informazioni per rispondere in modo preciso e scientifico.\n\n`;
          } else if (process.env.TAVILY_API_KEY) {
            // Fallback web search
            const webRisultati = await cercaTavily(domanda);
            if (webRisultati) {
              contextoPrepend = `RISULTATI WEB:\n${webRisultati}\n\nUSA queste informazioni come riferimento aggiuntivo.\n\n`;
            }
          }
        }
      } catch(ragErr) {
        // RAG fallito silenziosamente — continua senza contesto
        console.error('RAG error:', ragErr.message);
      }
    }

    // Prepara messaggi per Claude — inietta contesto se disponibile
    let finalMessages = messages;
    if (contextoPrepend) {
      finalMessages = messages.map((m, i) => {
        // Inietta il contesto nell'ultimo messaggio utente
        if (i === messages.length - 1 && m.role === 'user') {
          const contenuto = typeof m.content === 'string'
            ? contextoPrepend + m.content
            : [{ type: 'text', text: contextoPrepend }, ...(Array.isArray(m.content) ? m.content : [m.content])];
          return { ...m, content: contenuto };
        }
        return m;
      });
    }

    // Chiamata a Claude API
    const claudeRes = await httpsPost(
      'https://api.anthropic.com/v1/messages',
      {
        model: body.model || 'claude-sonnet-4-6',
        max_tokens: body.max_tokens || 1000,
        messages: finalMessages
      },
      {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(claudeRes.body)
    };

  } catch (error) {
    console.error('Proxy error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};
