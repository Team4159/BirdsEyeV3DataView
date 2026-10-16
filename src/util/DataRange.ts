export type DataRange = {
  min: number;
  max: number;
};

export function createDataRange(): DataRange {
  return {
    min: Number.MAX_SAFE_INTEGER,
    max: 0,
  };
}

export function extendDataRange(dataRange: DataRange, data: number) {
  if (data > dataRange.max) {
    dataRange.max = data;
  }
  if (data < dataRange.min) {
    dataRange.min = data;
  }
}
