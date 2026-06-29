#!/bin/sh
# Generate runtime config from environment variables
cat > /usr/share/nginx/html/config.json <<EOF
{
  "appName": "${APP_NAME:-miniqdb}",
  "loginButtonText": "${LOGIN_BUTTON_TEXT:-Login}",
  "nothingToSeeHereButtonText": "${NOTHING_TO_SEE_HERE_BUTTON_TEXT:-}",
  "pocketbaseUrl": "/"
}
EOF
