// From https://github.com/bloomberg/memray/blob/main/docs/tutorials/exercise_2/holding_onto_memory.py

import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const DUPLICATE_CONST = 2;

const SIZE_OF_DATA_IN_MB = 200;
const SUBTRACT_AMOUNT = 3;
const POWER_AMOUNT = 2;
const ADD_AMOUNT = 10;

function loadXMbOfData(mb: number) {
  // Generates objects on the V8 heap instead of external memory
  return Array.from({ length: mb * 10000 }, (_, i) => ({ value: 1 }));
}

// Make function harder for JIT to optimize
function processNumbers(
  data: { value: number }[],
  num: number | undefined,
  command: string,
) {
  switch (command) {
    case "duplicateData":
      return data.map((value) => ({ value: value.value * DUPLICATE_CONST }));
    case "addScalar": {
      if (num === undefined) {
        throw new Error("Expected numeric value to be greater than 0");
      }
      function addScalarFunc(
        a: { value: number },
        b: number,
      ): { value: number } {
        return { value: a.value + b };
      }
      return data.map(addScalarFunc);
    }
    case "subtractScalar": {
      if (num === undefined) {
        throw new Error("Expected numeric value to be greater than 0");
      }
      return data.map((value) => ({ value: value.value - num }));
    }
    case "raiseToPower": {
      if (num === undefined) {
        throw new Error("Expected numeric value to be greater than 0");
      }
      return data.map((value) => ({ value: Math.pow(value.value, num) }));
    }
    default:
      throw new Error("Unrecognized command");
  }
}

async function main() {
  console.log("Execution will start. Holding process open for profiling...");
  await new Promise((resolve) => setTimeout(resolve, 10000));

  // Force JS to wait for input to make it harder for JIT to optimize
  const rl = readline.createInterface({ input: stdin, output: stdout });

  let ans: string | undefined = undefined;
  const data = loadXMbOfData(SIZE_OF_DATA_IN_MB);

  ans = await rl.question("proceed?");
  let subtracted = data;
  if (ans === "y") {
    subtracted = processNumbers(data, SUBTRACT_AMOUNT, "subtractScalar");
  }

  ans = await rl.question("proceed?");
  let dataPow = subtracted;
  if (ans === "y") {
    dataPow = processNumbers(subtracted, POWER_AMOUNT, "raiseToPower");
  }

  ans = await rl.question("proceed?");
  let dataPow_ = dataPow;
  if (ans === "y") {
    dataPow_ = processNumbers(dataPow, undefined, "duplicateData");
  }

  ans = await rl.question("proceed?");
  let result = dataPow_;
  if (ans === "y") {
    result = processNumbers(dataPow_, ADD_AMOUNT, "addScalar");
  }

  console.log("Execution ended. Holding process open for profiling...");
  await new Promise((resolve) => setTimeout(resolve, 10000));

  console.log(result);

  rl.close();
}

main().then(() => {});
