const fs = require('fs');
const path = './grafana/provisioning/dashboards/default/router.json';
const dashboard = JSON.parse(fs.readFileSync(path, 'utf8'));

// 1. We want to move the Redis panels (which are currently under "Entity Cache (Redis)")
// to be under the empty "Entity cache" row.
// The "Entity cache" row is usually around index 20.
// Let's find "Entity cache" row:
const entityCacheRowIdx = dashboard.panels.findIndex(p => p.type === 'row' && p.title === 'Entity cache');
const redisRowIdx = dashboard.panels.findIndex(p => p.type === 'row' && p.title === 'Entity Cache (Redis)');
const segmentedRowIdx = dashboard.panels.findIndex(p => p.type === 'row' && p.title.includes('Segmented Workloads'));

// The Redis panels are immediately after the redisRowIdx until the next row or end.
const redisPanels = [];
let i = redisRowIdx + 1;
while (i < dashboard.panels.length && dashboard.panels[i].type !== 'row') {
  redisPanels.push(dashboard.panels[i]);
  i++;
}

// Remove the old "Entity Cache (Redis)" row and its panels
const idsToRemove = [dashboard.panels[redisRowIdx].id, ...redisPanels.map(p => p.id)];
dashboard.panels = dashboard.panels.filter(p => !idsToRemove.includes(p.id));

// Re-find entityCacheRowIdx after removal (though it shouldn't change if it was before redisRow)
const newEntityCacheRowIdx = dashboard.panels.findIndex(p => p.type === 'row' && p.title === 'Entity cache');
const insertY = dashboard.panels[newEntityCacheRowIdx].gridPos.y;

// Shift everything after Entity cache down by 10 to make room for Redis panels
for (let j = newEntityCacheRowIdx + 1; j < dashboard.panels.length; j++) {
  dashboard.panels[j].gridPos.y += 10;
}

// Set Y positions for Redis panels
for (const rp of redisPanels) {
  rp.gridPos.y = insertY + 1;
}

// Insert Redis panels right after "Entity cache"
dashboard.panels.splice(newEntityCacheRowIdx + 1, 0, ...redisPanels);

// Now fix the segmented workload panels to show data.
// Since I used a fake metric before, I'll switch to the real metrics.
const rpsPanel = dashboard.panels.find(p => p.title.includes("Throughput by Operation Type"));
if (rpsPanel) {
  rpsPanel.title = "Router Throughput (Total Operations/sec)";
  rpsPanel.targets[0].expr = "sum(rate(apollo_router_operations_total[1m]))";
  rpsPanel.targets[0].legendFormat = "Operations";
}

const latPanel = dashboard.panels.find(p => p.title.includes("P99 Latency"));
if (latPanel) {
  latPanel.title = "Router P99 Latency (Seconds)";
  latPanel.targets[0].expr = "histogram_quantile(0.99, sum by (le) (rate(apollo_router_http_request_duration_seconds_bucket[1m])))";
  latPanel.targets[0].legendFormat = "P99 Latency";
}

// Increment version so Grafana reloads it
dashboard.version = (dashboard.version || 0) + 1;

fs.writeFileSync(path, JSON.stringify(dashboard, null, 2));
console.log('Fixed Grafana dashboard layout and metrics, and incremented version.');
