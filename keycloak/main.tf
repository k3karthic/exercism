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
  
  # Optional: Customize token lifespans, themes, etc. here
}

# Create an OIDC Client configured for Authorization Code Flow
resource "keycloak_openid_client" "app_client" {
  realm_id                     = keycloak_realm.app_realm.id
  client_id                    = "my-app-client"
  name                         = "My Application Client"
  enabled                      = true
  
  # "CONFIDENTIAL" requires a client secret. Use "PUBLIC" if this is a SPA (React/Angular/Vue)
  access_type                  = "CONFIDENTIAL" 
  
  # Standard flow is the Authorization Code Flow in Keycloak
  standard_flow_enabled        = true
  
  # Disable other flows for security unless explicitly needed
  implicit_flow_enabled        = false
  direct_access_grants_enabled = false
  service_accounts_enabled     = false

  # Update these URIs to match your application's actual URLs
  valid_redirect_uris          = [
    "http://localhost:3000/api/auth/callback/keycloak",
    "http://localhost:3000/*"
  ]
  
  web_origins                  = ["+"] # "+" allows CORS from valid_redirect_uris
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
    value     = "Password123!"
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
