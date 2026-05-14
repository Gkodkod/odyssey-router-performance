const fs = require('fs');
const path = './grafana/provisioning/dashboards/default/router.json';
const dashboard = JSON.parse(fs.readFileSync(path, 'utf8'));

// The last two panels are the ones we added (they are at the end of the array)
const len = dashboard.panels.length;
if (len >= 2) {
  dashboard.panels[len - 2].gridPos.y = 200;
  dashboard.panels[len - 1].gridPos.y = 200;
  fs.writeFileSync(path, JSON.stringify(dashboard, null, 2));
  console.log('Fixed panel Y positions.');
}
