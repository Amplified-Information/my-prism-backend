#####
# variable definitions
#####
variable "env" {
  type        = string
  description = "Environment (dev, uat, prod)"
}
output "env" { value = var.env }

variable "aws_key_internal" {
  description = "The name of the key pair to use for SSH access to internal boxes"
  type        = string
}
output "aws_key_internal" { value = var.aws_key_internal }

variable "domain_name" {
  description = "The domain name for the environment"
  type        = string
}
output "domain_name" { value = var.domain_name }

# variable "aws_key_bastion" {
#   description = "The name of the key pair to use for SSH access to the bastion host"
#   type        = string
# }
# output "aws_key_bastion" { value = var.aws_key_bastion }

variable "aws_az" {
  description = "The AWS availability zone"
  type        = string
  default     = "us-east-1a"
}
output "aws_az" { value = var.aws_az }

variable "aws_az_2" {
  description = "The AWS availability zone (HA placeholder)"
  type        = string
  default     = "us-east-1b"
}
output "aws_az_2" { value = var.aws_az_2 }

# variable "eip" {
#   description = "The Elastic IP for the environment"
#   type        = string
# }
# output "eip" { value = var.eip }

variable "aws_region" {
  description = "The AWS region to use"
  type        = string
  default     = "us-east-1"
}
output "aws_region" { value = var.aws_region }

variable "ssl_cert_arn" {
  description = "The SSL certificate ARN for the environment"
  type        = string
}
output "ssl_cert_arn" { value = var.ssl_cert_arn }

variable "ssl_cert_arn_wildcard" {
  description = "The SSL certificate ARN for the environment (wildcard domain)"
  type        = string
}
output "ssl_cert_arn_wildcard" { value = var.ssl_cert_arn_wildcard }

variable "ebs_volume_id" {
  description = "The EBS volume ID to attach to the data instance"
  type        = string
}
output "ebs_volume_id" { value = var.ebs_volume_id }




# variable "ec2_type_bastion" {
#   type        = string
# }
# output "ec2_type_bastion" { value = var.ec2_type_bastion }

variable "ec2_type_proxy" {
  type        = string
}
output "ec2_type_proxy" { value = var.ec2_type_proxy }

variable "ec2_type_monolith" {
  type        = string
}
output "ec2_type_monolith" { value = var.ec2_type_monolith }

variable "ec2_type_data" {
  type        = string
}
output "ec2_type_data" { value = var.ec2_type_data }


variable "s3_bucket_deployment" {
  type        = string
}
output "s3_bucket_deployment" { value = var.s3_bucket_deployment }

variable "ghrc_secret_name" {
  type        = string
}
output "ghrc_secret_name" { value = var.ghrc_secret_name }



output "ami" { value = "ami-0f9c27b471bdcd702" } // Debian 13
# output "fixed_ip_bastion" { value = "10.0.0.9" } // N.B. bastion is on the public subnet 
output "fixed_ip_proxy" { value = "10.0.1.10" }     // private subnet 
output "fixed_ip_monolith" { value = "10.0.1.11" }  // private subnet 
output "fixed_ip_data" { value = "10.0.1.12" }      // private subnet 

output "install_base" {
  value = <<-EOF
#!/bin/bash

aws s3 cp s3://${var.s3_bucket_deployment}/bootstrap-base.sh /home/admin/bootstrap-base.sh --region ${var.aws_region}
chown admin:admin /home/admin/bootstrap-base.sh
bash /home/admin/bootstrap-base.sh ${var.aws_region} ${var.env} 

EOF
}

output "install_docker_runner" {
  value = <<-EOF
#!/bin/bash

aws s3 cp s3://${var.s3_bucket_deployment}/bootstrap-docker.sh /home/admin/bootstrap-docker.sh --region ${var.aws_region}
chown admin:admin /home/admin/bootstrap-docker.sh
bash /home/admin/bootstrap-docker.sh ${var.aws_region} ${var.env} ${var.s3_bucket_deployment} ${var.ghrc_secret_name}

EOF
}

# output "install_bastion" {
#   value = <<-EOF
# #!/bin/bash

# aws s3 cp s3://${var.s3_bucket_deployment}/bootstrap-bastion.sh /home/admin/bootstrap-bastion.sh --region ${var.aws_region}
# chown admin:admin /home/admin/bootstrap-bastion.sh
# bash /home/admin/bootstrap-bastion.sh

# EOF
# }

output "install_data" {
  value = <<-EOF
#!/bin/bash

aws s3 cp s3://${var.s3_bucket_deployment}/bootstrap-data.sh /home/admin/bootstrap-data.sh --region ${var.aws_region}
chown admin:admin /home/admin/bootstrap-data.sh
bash /home/admin/bootstrap-data.sh

EOF
}


#####
# VPC
#####
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  # Request an Amazon-provided IPv6 CIDR block
  assign_generated_ipv6_cidr_block = true

  tags = {
    Name = "${var.env}-vpc"
  }
}

#####
# Private Subnet
#####
resource "aws_subnet" "private" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  ipv6_cidr_block          = cidrsubnet(aws_vpc.main.ipv6_cidr_block, 8, 1) # first /64 from VPC
  availability_zone       = var.aws_az
  map_public_ip_on_launch = false

  tags = { Name = "${var.env}-private-subnet" }
}

#####
# Public Subnet
#####
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.0.0/24"
  ipv6_cidr_block          = cidrsubnet(aws_vpc.main.ipv6_cidr_block, 8, 0) # first /64 from VPC
  availability_zone       = var.aws_az
  map_public_ip_on_launch = true

  tags = { Name = "${var.env}-public-subnet" }
}

resource "aws_subnet" "public_2" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  ipv6_cidr_block          = cidrsubnet(aws_vpc.main.ipv6_cidr_block, 8, 2) # third /64 from VPC
  availability_zone       = var.aws_az_2
  map_public_ip_on_launch = true

  tags = { Name = "${var.env}-public-subnet" }
}


#####
# Internet Gateway
#####
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = { Name = "${var.env}-igw" }
}

#####
# NAT Gateway for IPv4 (IPv6 doesn't need NAT)
#####
resource "aws_eip" "nat" { # need an Elastic IP for the NAT Gateway
  tags = { Name = "${var.env}-nat" }
}

resource "aws_nat_gateway" "nat" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public.id

  tags = {
    Name = "${var.env}-nat"
  }
}


#####
# Route Table for Private Subnet
#####
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  # IPv4 default route via NAT
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat.id
  }

  # IPv6 default route directly via IGW
  route {
    ipv6_cidr_block = "::/0"
    gateway_id      = aws_internet_gateway.main.id
  }

  # instead use security groups for internal traffic
  # # N.B. Ensure there's a route to the private subnet for internal communication (e.g. proxy accessed on EIP can access 10.0.1.0/24 network)
  # route {
  #   cidr_block = "10.0.1.0/24" # private subnet CIDR
  #   gateway_id = aws_internet_gateway.main.id
  # }

  tags = { Name = "${var.env}-private-rt" }
}

resource "aws_route_table_association" "private" {
  subnet_id      = aws_subnet.private.id
  route_table_id = aws_route_table.private.id
}

#####
# Route Table for Public Subnet
#####
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  # IPv4 via IGW
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  # IPv6 via IGW
  route {
    ipv6_cidr_block = "::/0"
    gateway_id      = aws_internet_gateway.main.id
  }

  tags = { Name = "${var.env}-public-rt" }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}


#####
# Security Groups
#####
resource "aws_security_group" "allow_web_egress" {
  name   = "allow_web_egress"
  vpc_id = aws_vpc.main.id

  egress {
    description      = "Allow IPv4 outbound traffic on port 80"
    from_port        = 80
    to_port          = 80
    protocol         = "tcp"
    cidr_blocks      = ["0.0.0.0/0"]
  }

  egress {
    description      = "Allow IPv4 outbound traffic on port 443"
    from_port        = 443
    to_port          = 443
    protocol         = "tcp"
    cidr_blocks      = ["0.0.0.0/0"]
  }

  egress {
    description      = "Allow all IPv6 outbound traffic on port 80"
    from_port        = 80
    to_port          = 80
    protocol         = "tcp"
    ipv6_cidr_blocks = ["::/0"]
  }

  egress {
    description      = "Allow all IPv6 outbound traffic on port 443"
    from_port        = 443
    to_port          = 443
    protocol         = "tcp"
    ipv6_cidr_blocks = ["::/0"]
  }
}

resource "aws_security_group" "allow_email_egress" {
  name        = "allow_email_egress"
  description = "Allow outbound SMTP traffic to AWS SES"
  vpc_id      = aws_vpc.main.id

  egress {
    description = "Allow SMTP submission on port 587"
    from_port   = 587
    to_port     = 587
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow SMTP submission on port 465 (implicit TLS)"
    from_port   = 465
    to_port     = 465
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "allow_web_ingress" {
  name        = "allow_web_ingress"
  description = "Security group allowing HTTP (port 80) and HTTPS (port 443) ingress for IPv4 and IPv6"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Allow inbound HTTP traffic"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow inbound HTTP traffic ipv6"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    ipv6_cidr_blocks = ["::/0"]
  }

  ingress {
    description = "Allow inbound HTTPS traffic"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow inbound HTTPS traffic ipv6"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    ipv6_cidr_blocks = ["::/0"]
  }
}

resource "aws_security_group" "allow_internal_vpc" {
  name        = "allow_internal_vpc"
  description = "Allow internal traffic between instances"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["10.0.0.0/16"] # Allow traffic within the VPC
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["10.0.0.0/16"] # Allow traffic within the VPC
  }
}

resource "aws_security_group" "allow_internal_private_subnet" {
  name        = "allow_internal_private_subnet"
  description = "Allow internal traffic between instances"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["10.0.1.0/24"]  # allow internal subnet
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["10.0.1.0/24"]  # allow internal subnet
  }
}


resource "aws_security_group" "allow_ssh_ingress" {
  name          = "allow_ssh_ingress"
  description   = "Security group allowing SSH (port 22) ingress for IPv4"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Allow inbound SSH traffic"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow inbound SSH traffic ipv6"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    ipv6_cidr_blocks = ["::/0"]
  }
}

resource "aws_security_group" "allow_ssh_from_public_subnet" {
  name        = "allow_ssh_from_public_subnet"
  description = "Allow ssh traffic from the public subnet"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/24"] # Public subnet CIDR 10.0.0.0/24 and NOT 10.0.1.0/24
  }
}

resource "aws_security_group" "allow_8090_from_internet" {
  name        = "allow_8090_from_internet"
  description = "Allow 8090 traffic from the internet"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 8090
    to_port     = 8090
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Allow from anywhere on the internet
  }
}

resource "aws_security_group" "allow_proxy_ingress" {
  name        = "allow_proxy_ingress"
  description = "Allow proxy ingress traffic"
  vpc_id      = aws_vpc.main.id

  # API
  ingress {
    from_port   = 8888
    to_port     = 8888
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/24"] # Public subnet CIDR
  }

  # API - healthcheck
  ingress {
    from_port   = 8889
    to_port     = 8889
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/24"] # Public subnet CIDR
  }

  # clob
  ingress {
    from_port   = 50051
    to_port     = 50051
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/24"]
  }

  # web
  ingress {
    from_port   = 5173
    to_port     = 5173
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/24"]
  }

  # web.admin
  ingress {
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/24"]
  }

  # web.lp
  ingress {
    from_port   = 8081
    to_port     = 8081
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/24"]
  }
}

resource "aws_security_group" "allow_monolith_egress" {
  name        = "allow_monolith_egress"
  description = "Allow monolith egress traffic"
  vpc_id      = aws_vpc.main.id

  # API
  egress {
    from_port   = 8888
    to_port     = 8888
    protocol    = "tcp"
    cidr_blocks = ["10.0.1.0/24"] # Private subnet CIDR
  }

  # API - healthcheck
  egress {
    from_port   = 8889
    to_port     = 8889
    protocol    = "tcp"
    cidr_blocks = ["10.0.1.0/24"] # Private subnet CIDR
  }

  # clob
  egress {
    from_port   = 50051
    to_port     = 50051
    protocol    = "tcp"
    cidr_blocks = ["10.0.1.0/24"]
  }

  # web
  egress {
    from_port   = 5173
    to_port     = 5173
    protocol    = "tcp"
    cidr_blocks = ["10.0.1.0/24"]
  }

  # web.admin
  egress {
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["10.0.1.0/24"]
  }

  # web.lp
  egress {
    from_port   = 8081
    to_port     = 8081
    protocol    = "tcp"
    cidr_blocks = ["10.0.1.0/24"]
  }
}

# resource "aws_security_group" "allow_bastion_db" {
#   name        = "allow_bastion_db"
#   description = "Allow internal traffic from bastion to database"
#   vpc_id      = aws_vpc.main.id

#   ingress {
#     from_port   = 5432
#     to_port     = 5432
#     protocol    = "tcp"
#     cidr_blocks = ["10.0.0.0/24"] # Allow from public network
#   }

#   egress {
#     from_port   = 5432
#     to_port     = 5432
#     protocol    = "tcp"
#     cidr_blocks = ["10.0.0.0/24"]  # Allow from public network
#   }
# }

resource "aws_security_group" "allow_alb_egress" {
  name        = "allow_alb_egress"
  description = "Allow internal traffic from ALB to proxy"
  vpc_id      = aws_vpc.main.id

  egress {
    description = "Allow outbound traffic to port 8090 (ALB to target group)"
    from_port   = 8090
    to_port     = 8090
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}


# Security group for proxy to accept traffic from ALB (in public subnet)
resource "aws_security_group" "allow_alb_ingress" {
  name        = "alb_ingress"
  description = "Allow ingress from ALB on port 8090"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Allow inbound traffic from public subnet (where ALB lives) on port 8090"
    from_port   = 8090
    to_port     = 8090
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/24"]  # Public subnet CIDR
  }
}

resource "aws_security_group" "allow_hedera_rpc_egress" {
  name        = "allow_hedera_rpc_egress"
  description = "Allow outbound Hedera RPC traffic"
  vpc_id      = aws_vpc.main.id

  # Port 50212 — Smart Contract Service (EVM gRPC)

  # ipv4
  egress {
    from_port   = 50212
    to_port     = 50212
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # or restrict to Hedera node IP(s) if preferred
  }

  # ipv6
  egress {
    from_port        = 50212
    to_port          = 50212
    protocol         = "tcp"
    ipv6_cidr_blocks = ["::/0"] # or restrict to Hedera node IP(s) if preferred
  }

  # Port 50211 — Consensus / Crypto / Token / File services

  egress {
    from_port   = 50211
    to_port     = 50211
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # or restrict to Hedera node IP(s) if preferred
  }

  # ipv6
  egress {
    from_port        = 50211
    to_port          = 50211
    protocol         = "tcp"
    ipv6_cidr_blocks = ["::/0"] # or restrict to Hedera node IP(s) if preferred
  }
}

#####
# IAM roles
# - view files with `aws s3 ls s3://prismlabs-deployment --region us-east-1`
# - access `aws ssm get-parameter ...` - so can acccess the "read_ghcr" secret
#####

resource "aws_iam_role" "combined_role" {
   name = "${var.env}-combined-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Service = "ec2.amazonaws.com"
        },
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_policy" "combined_policy" {
  name        = "${var.env}-combined-policy"
  description = "Combined policy"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      // EC2 box has ssm read access
      {
        Effect = "Allow",
        Action = [
          "ssm:GetParameter"
        ],
        Resource = [
          "arn:aws:ssm:us-east-1:063088900305:parameter/read_ghcr",
          "arn:aws:ssm:us-east-1:063088900305:parameter/*"
        ]
      },
      {
        Effect = "Allow",
        Action = "ssm:DescribeParameters",
        Resource = "*"
      },
      // EC2 box has S3 READ access to "prismlabs-deployment"
      {
        Effect = "Allow",
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ],
        Resource = [
          "arn:aws:s3:::prismlabs-deployment",
          "arn:aws:s3:::prismlabs-deployment/*"
        ]
      },
      // EC2 box has S3 WRITE access to s3://pl-deployment-badges":
      {
        Effect = "Allow",
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:AbortMultipartUpload",
          "s3:ListBucket"
        ],
        Resource = [
          "arn:aws:s3:::pl-deployment-badges",
          "arn:aws:s3:::pl-deployment-badges/*"
        ]
      },
      // EC2 box has S3 WRITE access to s3://prismlabs-images:
      {
        Effect = "Allow",
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:AbortMultipartUpload",
          "s3:ListBucket"
        ],
        Resource = [
          "arn:aws:s3:::prismlabs-images",
          "arn:aws:s3:::prismlabs-images/*"
        ]
      },
      // EC2 box has S3 WRITE access to s3://prismlabs-fluent-bit:
      {
        Effect = "Allow",
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:AbortMultipartUpload",
          "s3:ListBucket"
        ],
        Resource = [
          "arn:aws:s3:::prismlabs-fluent-bit",
          "arn:aws:s3:::prismlabs-fluent-bit/*"
        ]
      },
      // EC2 box has CloudWatch Logs WRITE access (for Fluent Bit cloudwatch_logs output):
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ],
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/prism/${var.env}:*"
      }
    ]
  })
}

# IAM for SSM Session Manager (for AWS Console "Connect" via Session Manager)
# check with: `sudo systemctl status amazon-ssm-agent`
resource "aws_iam_role_policy_attachment" "ssm_managed_instance_core" {
  role       = aws_iam_role.combined_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}


resource "aws_iam_role_policy_attachment" "combined_policy_attach" {
  role       = aws_iam_role.combined_role.name
  policy_arn = aws_iam_policy.combined_policy.arn
}

resource "aws_iam_instance_profile" "combined_instance_profile" {
  name = "${var.env}-combined-instance-profile"
  role = aws_iam_role.combined_role.name
}



#####
# Outputs
#####
output "allow_web_egress_id" {
  value       = aws_security_group.allow_web_egress.id
}

output "allow_email_egress_id" {
  value = aws_security_group.allow_email_egress.id
}

output "allow_web_ingress_id" {
  value       = aws_security_group.allow_web_ingress.id
}

output "allow_internal_vpc_id" {
  value       = aws_security_group.allow_internal_vpc.id
}

output "allow_internal_private_subnet_id" {
  value       = aws_security_group.allow_internal_private_subnet.id
}

output "allow_ssh_ingress_id" {
  value       = aws_security_group.allow_ssh_ingress.id
}

output "allow_ssh_from_public_subnet_id" {
  value       = aws_security_group.allow_ssh_from_public_subnet.id
}

output "allow_8090_from_internet_id" {
  value       = aws_security_group.allow_8090_from_internet.id
}

output "allow_proxy_ingress_id" {
  value       = aws_security_group.allow_proxy_ingress.id
}

output "allow_monolith_egress_id" {
  value       = aws_security_group.allow_monolith_egress.id
}

# output "allow_bastion_db_id" {
#   value       = aws_security_group.allow_bastion_db.id
# }

output "allow_alb_egress_id" {
  value       = aws_security_group.allow_alb_egress.id
}

output "allow_alb_ingress_id" {
  value       = aws_security_group.allow_alb_ingress.id
}

output "allow_hedera_rpc_egress_id" {
  value       = aws_security_group.allow_hedera_rpc_egress.id
}






output "aws_subnet_public_id" {
  description = "ID of the public subnet"
  value       = aws_subnet.public.id
}

output "aws_subnet_public_id_2" {
  description = "ID of the second public subnet (placeholder for HA)"
  value       = aws_subnet.public_2.id
}

output "aws_subnet_private_id" {
  description = "ID of the private subnet"
  value       = aws_subnet.private.id
}

output "vpc_id" {
  description = "ID of the main VPC"
  value       = aws_vpc.main.id
}




output "combined_iam_policy_name" {
  value = aws_iam_instance_profile.combined_instance_profile.name
}

# apply a 30 day retention period to cloudwatch logs:
# resource "aws_cloudwatch_log_group" "fluent_bit" {
#   name              = "/prism/${var.env}"
#   retention_in_days = 30

#   lifecycle {
#     # N.B. do not destroy this aws_cloudwatch_log_group or your will lose your logs
#     prevent_destroy = true
#   }

#   tags = {
#     Environment = var.env
#   }
# }