const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");

const apiKey = "AIzaSyB6N4gIx23amBjWZJBciPXQX0xjbHuPr1Y";
const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
  try {
    fs.writeFileSync("result.txt", "Listing models...\n");
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=" + apiKey);
    const data = await response.json();
    const models = data.models.map(m => m.name).join("\n");
    fs.appendFileSync("result.txt", "Models:\n" + models);
  } catch (e) {
    fs.appendFileSync("result.txt", "Error during API call:\n" + e.toString());
  }
}
run();
run();
