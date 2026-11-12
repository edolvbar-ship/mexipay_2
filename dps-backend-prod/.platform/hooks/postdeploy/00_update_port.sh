#!/bin/bash

# Source the environment variables
source /opt/elasticbeanstalk/deployment/env

# Get the port from EB environment (default to 3001 if not set)
BACKEND_PORT=${PORT:-3001}

# Backup original config
cp /etc/nginx/conf.d/proxy.conf /etc/nginx/conf.d/proxy.conf.backup

# Replace the placeholder port with the actual port
sed -i "s/PROXY_BACKEND_PORT/${BACKEND_PORT}/g" /etc/nginx/conf.d/proxy.conf
sed -i "s/PORT=3000/PORT=${BACKEND_PORT}/g" /var/app/current/.env

# Uncomment the proxy_pass line if needed
sed -i "s/#proxy_pass/proxy_pass/g" /etc/nginx/conf.d/proxy.conf

# Test and reload nginx
if nginx -t; then
    nginx -s reload
    echo "$(date): Success - Nginx configured to use backend port: ${BACKEND_PORT}" >> /var/log/nginx/port_config.log
else
    # Restore backup if config test fails
    cp /etc/nginx/conf.d/proxy.conf.backup /etc/nginx/conf.d/proxy.conf
    echo "$(date): ERROR - Nginx config test failed, restored backup" >> /var/log/nginx/port_config.log
    exit 1
fi