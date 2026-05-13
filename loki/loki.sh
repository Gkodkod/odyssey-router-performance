#!/bin/sh
rm -rf /tmp/loki/*
mkdir -p /tmp/loki/chunks /tmp/loki/rules
chown -R 10001:10001 /tmp/loki
chmod -R 777 /tmp/loki
echo "Created directories for Loki with broad permissions"
