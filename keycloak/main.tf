terraform {
  required_providers {
    keycloak = {
      source  = "keycloak/keycloak"
      version = ">= 5.7.0"
    }
  }
}

# Configure the Keycloak provider to talk to our local Podman container
provider "keycloak" {
  client_id = "admin-cli"
  username  = "admin"
  password  = "admin"
  url       = "http://127.0.0.1:8080"
}

# Create a new Realm for our application
resource "keycloak_realm" "app_realm" {
  realm   = "my-app-realm"
  enabled = true

  # Match the Keycloakify theme name generated from keycloakify-starter/
  login_theme = "keycloakify-starter"

  # Short-lived tokens and sessions reduce the impact of a stolen token.
  default_signature_algorithm = "RS256"
  access_token_lifespan       = "10m"
  sso_session_idle_timeout    = "30m"
  sso_session_max_lifespan    = "10h"
}

# Explicit signing key provider so the realm does not rely only on defaults.
resource "keycloak_realm_keystore_rsa_generated" "app_signing_key" {
  realm_id  = keycloak_realm.app_realm.id
  name      = "my-app-signing-key"
  enabled   = true
  active    = true
  priority  = 100
  algorithm = "RS256"
  key_size  = 2048
}

# Create an OIDC Client configured for Authorization Code Flow
resource "keycloak_openid_client" "app_client" {
  realm_id  = keycloak_realm.app_realm.id
  client_id = "my-app-client"
  name      = "My Application Client"
  enabled   = true

  # "CONFIDENTIAL" requires a client secret. Use "PUBLIC" if this is a SPA (React/Angular/Vue)
  access_type = "CONFIDENTIAL"

  # Standard flow is the Authorization Code Flow in Keycloak
  standard_flow_enabled = true

  # Disable other flows for security unless explicitly needed
  implicit_flow_enabled        = false
  direct_access_grants_enabled = false
  service_accounts_enabled     = false
  full_scope_allowed           = false

  # Update these URIs to match your application's actual URLs
  valid_redirect_uris = [
    "http://localhost:3000/api/auth/callback/keycloak",
    "http://localhost:3000/*"
  ]

  web_origins = ["+"] # "+" allows CORS from valid_redirect_uris
}

# Optional scope used to add an aud claim for the API without bloating every token.
resource "keycloak_openid_client_scope" "app_audience_scope" {
  realm_id    = keycloak_realm.app_realm.id
  name        = "my-app-audience-scope"
  description = "Adds the API audience to tokens only when requested."
}

# Attach the audience mapper to the scope so only scoped tokens include the audience.
resource "keycloak_openid_audience_protocol_mapper" "app_audience_mapper" {
  realm_id                 = keycloak_realm.app_realm.id
  client_scope_id          = keycloak_openid_client_scope.app_audience_scope.id
  name                     = "my-app-audience-mapper"
  included_custom_audience = "my-app-api"
  add_to_id_token          = false
  add_to_access_token      = true
}

# Keep the scope optional so the client can request it explicitly.
resource "keycloak_openid_client_optional_scopes" "app_optional_scopes" {
  realm_id  = keycloak_realm.app_realm.id
  client_id = keycloak_openid_client.app_client.id

  optional_scopes = [
    "address",
    "phone",
    "offline_access",
    "microprofile-jwt",
    keycloak_openid_client_scope.app_audience_scope.name,
  ]
}

# Create a sample user
resource "keycloak_user" "sample_user" {
  realm_id       = keycloak_realm.app_realm.id
  username       = "testuser"
  enabled        = true
  email          = "testuser@example.com"
  email_verified = true
  first_name     = "Test"
  last_name      = "User"

  # Hardcoded password setup
  initial_password {
    value = "Password123!"
    # Set to false so the user isn't forced to change it on first login
    temporary = false
  }
}

# Output the Client Secret so you can easily copy it into your app's .env file
output "client_secret" {
  value       = keycloak_openid_client.app_client.client_secret
  description = "The client secret for the OIDC client"
  sensitive   = true
}
