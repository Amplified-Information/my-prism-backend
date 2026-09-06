
#!/bin/bash
set -e

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <ContractName>"
  echo "where <ContractName> is the name of the contract to compile. e.g. Prism, Proxy, etc."
  exit 1
fi

CONTRACT_NAME=$1

solc ../contracts/$CONTRACT_NAME.sol \
  --abi --bin --metadata --optimize --via-ir \
  --base-path ../contracts \
  --include-path ../node_modules \
  -o ../contracts/out --overwrite

cd ../contracts/out

for f in *.bin; do
  new="${f##*_}"
  if [ "$f" != "$new" ]; then
    mv -f -- "$f" "$new"
  fi
done

ls -altr .

echo ""
echo "ABI for $CONTRACT_NAME.sol:"
cat ${CONTRACT_NAME}.abi
echo ""
echo ""

echo "Compiled files location: $(pwd)"
echo "Compilation of $CONTRACT_NAME.sol completed."
