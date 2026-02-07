#!/bin/bash

# AWS EC2 instances with a public DNS name:
aws ec2 describe-instances \
  --filters "Name=instance-state-name,Values=running" \
  --query "Reservations[*].Instances[*].[Tags[?Key=='Name']|[0].Value,PublicDnsName]" \
  --output text | awk '$1 && $2'