#!/bin/bash

# Shared e2e setup. Every RPC goes through Envoy using grpc-web.

# easyrpc only reads the first 16 KiB of a grpc-web response body and then fails with
# "unexpected EOF", so pages must stay well under that. Intent rows are ~345 bytes.
PAGE_LIMIT="${PAGE_LIMIT:-25}"

# Safety net only - pagination.hasMore is what actually ends the paging loops.
MAX_PAGES="${MAX_PAGES:-200}"

e2e_env_get() {
	local key="$1"
	awk -F '=' -v k="$key" '$1 == k {
		value = substr($0, index($0, "=") + 1)
		sub(/^[[:space:]]+/, "", value)
		sub(/[[:space:]]+$/, "", value)
		print value
		exit
	}' "$ENV_FILE"
}

e2e_require() {
	local command_name
	for command_name in easyrpc jq; do
		if ! command -v "$command_name" >/dev/null 2>&1; then
			echo "Error: required command not found: $command_name" >&2
			return 1
		fi
	done
	if [[ ! -d "$PROTO_DIR" ]]; then
		echo "Error: proto directory not found at $PROTO_DIR" >&2
		return 1
	fi
}

e2e_init() {
	local default_url prompt_label
	prompt_label="${1:-BASE_URL}"

	if [[ ! -f "$ENV_FILE" ]]; then
		echo "Error: .env file not found at $ENV_FILE" >&2
		return 1
	fi
	e2e_require

	default_url="${BASE_URL:-$(e2e_env_get BASE_URL)}"
	if [[ -z "$default_url" ]]; then
		default_url="https://testnet.dev.prism.market"
	fi
	read -r -p "Enter $prompt_label [$default_url]: " base_url
	base_url="${base_url:-$default_url}"
	baseUrl="$base_url"

	if grep -q '^BASE_URL=' "$ENV_FILE"; then
		sed -i "s|^BASE_URL=.*|BASE_URL=$base_url|" "$ENV_FILE"
	else
		printf '\nBASE_URL=%s\n' "$base_url" >> "$ENV_FILE"
	fi

	network="testnet"
	case "$base_url" in
		*previewnet*) network="previewnet" ;;
		*mainnet*) network="mainnet" ;;
	esac

	grpc_addr="${base_url#*://}"
	grpc_addr="${grpc_addr%%/}"
	grpc_flags=(-w)
	grpc_meta=()
	if [[ "$base_url" == https://* ]]; then
		grpc_flags=(-w --tls)
		[[ "$grpc_addr" == *:* ]] || grpc_addr="${grpc_addr}:443"
	fi

	if [[ "$grpc_addr" == *:8888 ]]; then
		echo "Error: direct gRPC target ':8888' is not allowed. Use BASE_URL through Envoy." >&2
		return 1
	fi

	echo "BASE_URL: $base_url"
	echo "gRPC-Web proxy: $grpc_addr"
}

e2e_configure_proxy() {
	local url="$1"
	base_url="$url"
	baseUrl="$url"
	grpc_addr="${url#*://}"
	grpc_addr="${grpc_addr%%/}"
	grpc_flags=(-w)
	if [[ "$url" == https://* ]]; then
		grpc_flags=(-w --tls)
		[[ "$grpc_addr" == *:* ]] || grpc_addr="${grpc_addr}:443"
	fi
	if [[ "$grpc_addr" == *:8888 ]]; then
		echo "Error: direct gRPC target ':8888' is not allowed. Use BASE_URL through Envoy." >&2
		return 1
	fi
}

e2e_bearer_header() {
	local token="$1"
	token="${token#Bearer }"
	printf 'Bearer %s' "$token"
}

# Emits "<hasMore>\t<nextOffset>" for a paged response. Falls back to row counting when the
# server predates the pagination block, so loops work against both API versions.
e2e_page_state() {
	local json="$1" rows="$2" offset="$3" limit="$4"

	printf '%s\n' "$json" | jq -r \
		--argjson rows "$rows" \
		--argjson offset "$offset" \
		--argjson limit "$limit" '
		if (.pagination.total // null) != null then
			[(.pagination.hasMore // false), (.pagination.nextOffset // ($offset + $rows))]
		else
			[($rows >= $limit), ($offset + $rows)]
		end
		| @tsv
	'
}

e2e_rpc() {
	easyrpc c "${grpc_flags[@]}" "${grpc_meta[@]}" \
		-a "$grpc_addr" \
		-i "$PROTO_DIR" \
		-p api.proto \
		"$@"
}

e2e_preflight() {
	echo "Preflight: checking grpc-web Health on $grpc_addr..."
	e2e_rpc -d '{}' api.ApiServicePublic.Health >/dev/null
}

