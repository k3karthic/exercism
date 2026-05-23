// From https://github.com/bloomberg/memray/blob/main/docs/tutorials/exercise_2/holding_onto_memory.py

const MB_CONVERSION = 1000 * 1000;
const DUPLICATE_CONST = 2;

const SIZE_OF_DATA_IN_MB = 100;
const SUBTRACT_AMOUNT = 3;
const POWER_AMOUNT = 2;
const ADD_AMOUNT = 10;

function loadXMbOfData(mb: number): Uint8Array {
  const size = MB_CONVERSION * mb;
  return new Uint8Array(size).fill(1);
}

function duplicateData(data: Uint8Array): Uint8Array {
  return data.map((value) => value * DUPLICATE_CONST);
}

function addScalar(data: Uint8Array, scalar: number): Uint8Array {
  return data.map((value) => value + scalar);
}

function subtractScalar(data: Uint8Array, scalar: number): Uint8Array {
  return data.map((value) => value - scalar);
}

function raiseToPower(data: Uint8Array, power: number): Uint8Array {
  return data.map((value) => Math.pow(value, power));
}

function processData(): Uint8Array {
  const data = loadXMbOfData(SIZE_OF_DATA_IN_MB);
  const subtracted = subtractScalar(data, SUBTRACT_AMOUNT);
  const dataPow = raiseToPower(subtracted, POWER_AMOUNT);
  return addScalar(duplicateData(dataPow), ADD_AMOUNT);
}

processData();
