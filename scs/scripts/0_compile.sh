
#!/bin/bash
set -e

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <ContractName>"
  exit 1
fi

CONTRACT_NAME=$1

solc ../contracts/$CONTRACT_NAME.sol --bin --optimize --via-ir --allow-paths ../node_modules/ -o ../contracts/out --overwrite

cd ../contracts/out

for f in *.bin; do
  new="${f##*_}"
  if [ "$f" != "$new" ]; then
    mv -f -- "$f" "$new"
  fi
done

ls -altr .

echo "Compilation of $CONTRACT_NAME.sol completed."