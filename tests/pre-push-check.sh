#!/bin/sh
# Gate prima di ogni commit/push su v2: se fallisce, NON pubblicare.
set -e
cd "$(dirname "$0")/.."
echo "1/3 sintassi dello script principale"
python3 - <<'PY'
import re
s=open('index.html').read()
open('/tmp/_chk.js','w').write(max(re.findall(r'<script>(.*?)</script>',s,re.S),key=len))
PY
node --check /tmp/_chk.js
echo "2/3 suite automatica"
node --test tests/*.test.js 2>&1 | tee /tmp/_suite.txt | grep -E "^# (tests|pass|fail)"
grep -q "^# fail 0" /tmp/_suite.txt
echo "3/3 nessun riferimento a bin di produzione"
! grep -nE "ALLOW_PROD_BINS" index.html
echo "OK: puoi procedere"
