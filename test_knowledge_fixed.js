// Verify fixed knowledge loader
const { readFileSync } = require("fs");
const { join } = require("path");

const filePath = join(__dirname, "..", "data", "troubleshooting_guide.json");
const raw = readFileSync(filePath, "utf-8");
const data = JSON.parse(raw);

var pageMap = {
  furnace: [6, 7],
  conveyor: [8],
  slurry_pump: [10, 11],
  motor: [12, 13],
};

var criticalPages = [7, 17, 18, 19, 20, 21];

Object.keys(pageMap).forEach(function(machineType) {
  var targetPages = pageMap[machineType];
  var allPages = targetPages.concat(criticalPages.filter(function(p) { return targetPages.indexOf(p) === -1; }));

  console.log("\n=== " + machineType.toUpperCase() + " ===");
  console.log("Pages loaded: " + allPages.join(", "));

  allPages.forEach(function(pageNum) {
    var page = data.pages.find(function(p) { return p.page === pageNum; });
    if (page && page.content.length > 0) {
      var firstLine = page.content.split("\n")[0].substring(0, 80);
      // Check for machine-type specific keywords
      var content = page.content.toLowerCase();
      var keywords = [];
      if (content.indexOf(machineType.replace("_", " ")) !== -1) keywords.push(machineType);
      if (content.indexOf("refractory") !== -1) keywords.push("refractory");
      if (content.indexOf("bearing") !== -1) keywords.push("bearing");
      if (content.indexOf("cavitation") !== -1) keywords.push("cavitation");
      if (content.indexOf("impeller") !== -1) keywords.push("impeller");
      if (content.indexOf("vibration") !== -1) keywords.push("vibration");
      if (content.indexOf("temperature") !== -1) keywords.push("temperature");
      if (content.indexOf("pressure") !== -1) keywords.push("pressure");
      if (content.indexOf("safety") !== -1 || content.indexOf("urgent") !== -1) keywords.push("safety/urgent");
      if (content.indexOf("output format") !== -1) keywords.push("output-format");
      if (content.indexOf("priority") !== -1) keywords.push("priority");
      if (content.indexOf("workflow") !== -1) keywords.push("workflow");

      console.log("  Page " + pageNum + " (" + page.content.length + " chars): " + firstLine);
      console.log("    Keywords: " + keywords.join(", "));
    } else if (page && page.content.length === 0) {
      console.log("  Page " + pageNum + " (EMPTY)");
    } else {
      console.log("  Page " + pageNum + " (NOT FOUND)");
    }
  });
});

// Total knowledge size per machine type
console.log("\n=== Knowledge Size ===");
Object.keys(pageMap).forEach(function(machineType) {
  var targetPages = pageMap[machineType];
  var allPages = targetPages.concat(criticalPages.filter(function(p) { return targetPages.indexOf(p) === -1; }));
  var totalChars = 0;
  allPages.forEach(function(pageNum) {
    var page = data.pages.find(function(p) { return p.page === pageNum; });
    if (page) totalChars += page.content.length;
  });
  console.log("  " + machineType + ": " + totalChars + " chars (~" + Math.round(totalChars / 4) + " tokens)");
});
