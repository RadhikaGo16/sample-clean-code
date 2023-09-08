#!/usr/bin/env node
/**
 * clean-code
 * cleans code
 *
 * @author viraj patil
 */
const cli = require("./utils/cli");
const log = require("./utils/log");
require("dotenv").config();
const { OpenAI, LLMChain, PromptTemplate } = require("langchain");
const { ConversationSummaryMemory } = require("langchain/memory");
const fs = require("fs");
const input = cli.input;
const flags = cli.flags;
const { debug } = flags;
let dataJson = require("./rules.json");
(async () => {
  input.includes(`help`) && cli.showHelp(0);
  debug && log(flags);
  if (input.includes("clean")) {
    const directoryPath = input[1];
    const singleRule = input[2]
    if(singleRule){
      dataJson = {[singleRule]: dataJson[singleRule]}
    }
    processFiles(directoryPath );
  }
})();
function processFiles(directoryPath) {
  fs.readdir(directoryPath, (err, fileNames) => {
    if (err) {
      console.error("Error reading directory:", err);
      return;
    }
    fileNames.forEach((fileName) => {
      const finalResult = [];
      const averages = [];
      for (let topic in dataJson) {
        const filePath = `${directoryPath}/${fileName}`;
        fs.stat(filePath, (err, stats) => {
          if (err) {
            console.error("Error getting file stats:", err);
            return;
          }
          if (stats.isDirectory()) {
            processFiles(filePath); // Recursively process subdirectories
          } else {
            fs.readFile(
              `${input[1]}/${fileName}`,
              "utf-8",
              async (err, data) => {
                if (err) {
                  return;
                }
                const text = data;
                const fileName2 = fileName.split(".js")[0];
                const llm = new OpenAI({ 
                  modelName: "gpt-3.5-turbo-16k",
                  temperature: 0.2,
                  openAIApiKey: process.env.OPEN_API_KEY,
                });
                const promptTemplate = `You know how to write clean code. I am giving you Combination of HTML, CSS, JavaScript, and TypeScript code may be found in the below file. You must separate it, check the code snippet in accordance with the rules below, and give each rule a score of 10 to complete . 
          :\n${dataJson[topic].join(
            "\n"
          )}\nGive a brief justification of your scoring along with examples of what can be done in the code to improve it.\nDo not send me the corrected code in response.\nI want response in following format\n  RuleName: name of the rule. Score: out of 10. Justification: in brief upto 20 words.  \n{chat_history}\nHuman: {input}\nAI:\n Do not divert or vary from given specific format and even be case sensitive. Also I want Every Rule Response In A Single Line`;
                const prompt = PromptTemplate.fromTemplate(promptTemplate);
                const summary_memory = new ConversationSummaryMemory({
                  llm: llm,
                  memoryKey: "chat_history",
                });
                const conversation = new LLMChain({
                  llm: llm,
                  memory: summary_memory,
                  prompt: prompt,
                });
                let result = await conversation.predict({
                  input: text,
                });
                console.log(result);
                const lines = result
                  .split("\n")
                  .filter((line) => line.trim() !== "");
                let ratingAverage = 0;
                const resultData = lines.map((line) => {
                  if (line) {
                    const [rule, justification] = line.split("Justification:");
                    const [ruleName, rating] =
                      rule.split(/Score\s*:\s*(\d+)/) || [];
                    if (rating) {
                      ratingAverage += parseInt(rating);
                    }
                    return {
                      topic: topic,
                      ruleName: ruleName
                        ? ruleName.replace("RuleName:", "")
                        : "",
                      justification: justification
                        ? justification.replace(/,/g, " and")
                        : "",
                      rating: rating ? rating.trim() : "", 
                    };
                  } else {
                    return {
                      topic: "",
                      ruleName: "",
                      justification: "",
                      rating: "",
                    };
                  }
                });
                resultData.forEach((res) => {
                  finalResult.push(res);
                });
                let average = ratingAverage / dataJson[topic].length;
                finalResult.push({
                  topic: `${topic} Averages`,
                  ruleName: "",
                  justification: "",
                  rating: average,
                });
                finalResult.push({
                  topic: "",
                  ruleName: "",
                  justification: "",
                  rating: "",
                });
                averages.push(average);
                if (averages.length === Object.keys(dataJson).length) {
                  let totalAverage =
                    averages.reduce(
                      (accumulator, currentValue) => accumulator + currentValue,
                      0
                    ) / Object.keys(dataJson).length;
                  finalResult.push({
                    topic: "",
                    ruleName: "",
                    justification: "",
                    rating: "",
                  });
                  finalResult.push({
                    topic: "Overall Average",
                    ruleName: "",
                    justification: "",
                    rating: totalAverage,
                  });
                  if (fs.existsSync(`
                  reports/${fileName2}result.csv`)) {
                    console.log("CSV file already exists");
                    fs.unlink(`reports/${fileName2}result.csv`, (err) => {
                      if (err) {
                        console.error("Error deleting CSV file:", err);
                      } else {
                        const csvContent = [
                          ["Topic", "RuleName", "Justification", "Score"],
                          ...finalResult.map((obj) => [
                            obj.topic,
                            obj.ruleName,
                            obj.justification,
                            obj.rating,
                          ]),
                        ]
                          .map((row) => row.join(","))
                          .join("\n");
  
                        fs.writeFile(
                          `reports/${fileName2}result.csv`,
                          csvContent,
                          "utf8",
                          (err) => {
                            if (err) {
                              console.error(
                                "An error occurred while writing the file:",
                                err
                              );
                            } else {
                              console.log(
                                `CSV file has been successfully saved for ${fileName2}`
                              );
                            }
                          }
                        );
                        console.log(
                          `deleted and created successfully for ${fileName2} `
                        );
                      }
                    });
                  } else {
                    const csvContent = [
                      ["Topic", "RuleName", "Justification", "Score"], // Column names
                      ...finalResult.map((obj) => [
                        obj.topic,
                        obj.ruleName,
                        obj.justification,
                        obj.rating,
                      ]),
                    ]
                      .map((row) => row.join(","))
                      .join("\n");
  
                    fs.writeFile(
                      `reports/${fileName2}result.csv`,
                      csvContent,
                      "utf8",
                      (err) => {
                        if (err) {
                          console.error(
                            "An error occurred while writing the file:",
                            err
                          );
                        } else {
                          console.log(
                            `CSV file has been successfully saved. for ${fileName2}`
                          );
                        }
                      }
                    );
                  }
                }
              }
            );
          }
        });
      }
    });
  });
}