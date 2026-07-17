// Test knowledge loader - verify PDF content is loaded correctly
const { readFileSync } = require("fs");
const { join } = require("path");

const filePath = join(__dirname, "..", "data", "troubleshooting_guide.json");
console.log("File path:", filePath);

try {
  const raw = readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);

  console.log("\n=== PDF JSON Metadata ===");
  console.log("Source:", data.source);
  console.log("Total pages:", data.total_pages);
  console.log("Pages array length:", data.pages.length);

  console.log("\n=== Page Content Summary ===");
  data.pages.forEach(function(p) {
    var preview = p.content.substring(0, 120).replace(/\n/g, " ");
    console.log("Page " + p.page + " (" + p.content.length + " chars): " + preview + "...");
  });

  // Simulate getKnowledgeByMachineType for furnace
  console.log("\n=== Knowledge loaded for FURNACE ===");
  var furnacePages = [3, 4, 5];
  var criticalPages = [7, 17, 18, 19, 20, 21];
  var allPages = furnacePages.concat(criticalPages.filter(function(p) { return furnacePages.indexOf(p) === -1; }));

  allPages.forEach(function(pageNum) {
    var page = data.pages.find(function(p) { return p.page === pageNum; });
    if (page) {
      console.log("\n--- Page " + pageNum + " (" + page.content.length + " chars) ---");
      console.log(page.content.substring(0, 300));
      if (page.content.length > 300) console.log("... [" + (page.content.length - 300) + " more chars]");
    } else {
      console.log("\n--- Page " + pageNum + " NOT FOUND ---");
    }
  });

  // Check if furnace-specific content mentions furnace
  console.log("\n=== Furnace keyword check ===");
  furnacePages.forEach(function(pageNum) {
    var page = data.pages.find(function(p) { return p.page === pageNum; });
    if (page) {
      var hasFurnace = page.content.toLowerCase().indexOf("furnace") !== -1;
      var hasTemp = page.content.toLowerCase().indexOf("temperature") !== -1;
      var hasRefractory = page.content.toLowerCase().indexOf("refractory") !== -1;
      console.log("Page " + pageNum + ": furnace=" + hasFurnace + " | temperature=" + hasTemp + " | refractory=" + hasRefractory);
    }
  });

} catch (e) {
  console.error("Error:", e.message);
}
