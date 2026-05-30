# Local Keycloak Development Environment

This project spins up a local instance of Keycloak using Podman and provisions it using Terraform.

## Prerequisites
* [Podman](https://podman.io/) installed.
* [Terraform](https://www.terraform.io/) installed.

## Step 1: Start Keycloak

Run the following Podman command to start Keycloak in development mode. 
* The `--rm` flag ensures the container is automatically removed when stopped.
* We map port `8080` to the host.
* We set default admin credentials (`admin` / `admin`).

```bash
podman run --rm -p 8080:8080 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin \
  keycloak/keycloak:latest start-dev
```

## Step 2: Configure Keycloak

Terraform script uses the official Keycloak provider to set up a new Realm, an OIDC Client configured for the **Authorization Code Flow** (`standard_flow_enabled = true`), and a sample user with a permanent, hardcoded password.

Apply the configuration:
```bash
terraform init
terraform apply
```

Extract the client secret using:
```bash
terraform output -raw client_secret
```
