const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");

const apiKey = "AIzaSyB6N4gIx23amBjWZJBciPXQX0xjbHuPr1Y";
const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
  try {
    fs.writeFileSync("result2.txt", "Configuring model...\n");
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      tools: [
        {
          googleSearchRetrieval: {},
        },
      ],
      systemInstruction: "Test instruction"
    });
    fs.appendFileSync("result2.txt", "Starting chat...\n");
    const chat = model.startChat({ history: [] });
    fs.appendFileSync("result2.txt", "Sending message...\n");
    const result = await chat.sendMessage("hello");
    fs.appendFileSync("result2.txt", "Success: " + result.response.text());
  } catch (e) {
    fs.appendFileSync("result2.txt", "Runtime Error: " + e.toString() + "\n" + (e.stack || ""));
  }
}
run();
