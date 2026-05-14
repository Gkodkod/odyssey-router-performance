const fs = require('fs');
const path = './grafana/provisioning/dashboards/default/router.json';
const dashboard = JSON.parse(fs.readFileSync(path, 'utf8'));

// Find our custom panels
const rpsPanel = dashboard.panels.find(p => p.title === "Throughput by Operation Type (Queries vs Mutations)");
const latPanel = dashboard.panels.find(p => p.title === "P99 Latency (Query vs Mutation)");

// Remove them from the current array
dashboard.panels = dashboard.panels.filter(p => p.id !== rpsPanel.id && p.id !== latPanel.id);

// Find index of "Traces" row
const tracesIdx = dashboard.panels.findIndex(p => p.type === 'row' && p.title === 'Traces');

if (tracesIdx !== -1) {
  // Get the Y position of the Traces row
  const insertY = dashboard.panels[tracesIdx].gridPos.y;

  // Move everything from tracesIdx onwards down by 10 units
  for (let i = tracesIdx; i < dashboard.panels.length; i++) {
    dashboard.panels[i].gridPos.y += 10;
  }

  let maxId = 0;
  for (const p of dashboard.panels) {
    if (p.id > maxId) maxId = p.id;
  }

  const newRow = {
    "id": ++maxId,
    "gridPos": { "h": 1, "w": 24, "x": 0, "y": insertY },
    "type": "row",
    "title": "Segmented Workloads (Queries vs Mutations)"
  };

  rpsPanel.id = ++maxId;
  rpsPanel.gridPos = { "h": 8, "w": 12, "x": 0, "y": insertY + 1 };

  latPanel.id = ++maxId;
  latPanel.gridPos = { "h": 8, "w": 12, "x": 12, "y": insertY + 1 };

  // Insert them right before Traces
  dashboard.panels.splice(tracesIdx, 0, newRow, rpsPanel, latPanel);
}

// CRITICAL: Increment the version so Grafana knows it must overwrite the DB version!
dashboard.version = (dashboard.version || 0) + 1;

fs.writeFileSync(path, JSON.stringify(dashboard, null, 2));
console.log('Fixed Grafana dashboard layout and incremented version.');
