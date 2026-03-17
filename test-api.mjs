import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "AIzaSyB6N4gIx23amBjWZJBciPXQX0xjbHuPr1Y";
console.log("Using API key:", apiKey ? apiKey.substring(0, 10) + "..." : "NONE");

const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Hello, how are you?");
    console.log("Success! Response:");
    console.log(result.response.text());
  } catch (e) {
    console.error("Error during API call:");
    console.error(e);
  }
}
run();
