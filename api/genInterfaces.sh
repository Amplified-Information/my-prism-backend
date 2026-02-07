#!/bin/bash

# sudo apt-get install -y protobuf-compiler
# RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.10
# RUN go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.5.1
# RUN go install github.com/envoyproxy/protoc-gen-validate@v1.2.1

# db/schema.sql must exist (location is set in sqlc.yaml config file)
if [ ! -f "db/schema.sql" ]; then
  echo "Error: db/schema.sql does not exist."
  exit 1
fi



rm -rf gen
mkdir -p gen/clob

echo "Generating sqlc interfaces..."
cd db
sqlc generate
cd ..
echo "-> sqlc interfaces generated."
echo ""

#protoc --proto_path=proto --proto_path=proto/validate --go_out=gen --go_opt=paths=source_relative --go-grpc_out=gen --go-grpc_opt=paths=source_relative --validate_out="lang=go,paths=source_relative:gen" proto/api.proto
protoc \
  --proto_path=./proto \
  --proto_path=/usr/include \
  --proto_path=proto/validate \
  --go_out=gen --go_opt=paths=source_relative \
  --go-grpc_out=gen --go-grpc_opt=paths=source_relative \
  --validate_out="lang=go,paths=source_relative:gen" \
  ./proto/api.proto

protoc \
  --proto_path=../clob/proto \
  --proto_path=/usr/include \
  --go_out=gen/clob --go_opt=paths=source_relative --go_opt=Mclob.proto=./gen/clob \
  --go-grpc_out=gen/clob --go-grpc_opt=paths=source_relative --go-grpc_opt=Mclob.proto=./gen/clob \
  --validate_out="lang=go,paths=source_relative:gen/clob" \
  ../clob/proto/clob.proto

echo "Done."
echo -e "Protobufs generated in gen:\n"
echo $(pwd)

ls -al gen/
