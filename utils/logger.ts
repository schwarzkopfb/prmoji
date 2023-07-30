import { cyan, green, red, yellow } from "std/fmt/colors.ts";

type MessagePart =
  | string
  | number
  | boolean
  | undefined
  | null
  | Record<string, unknown>
  | RegExpMatchArray
  | [];

export enum Levels {
  SILENT = 0,
  ERROR = 1,
  INFO = 2,
  DEBUG = 3,
  SILLY = 4,
}

const levelNames = {
  [Levels.SILENT]: "SILENT",
  [Levels.ERROR]: "ERROR",
  [Levels.INFO]: "INFO",
  [Levels.DEBUG]: "DEBUG",
  [Levels.SILLY]: "SILLY",
};

let currentLevel = Levels.INFO;

export function setLevel(level: Levels): void {
  currentLevel = level;
  info("logging level set to", levelNames[level]);
}

function createLoggerFn(
  level: Levels,
  label = "",
): (...messageParts: MessagePart[]) => void {
  const log = level === Levels.ERROR ? console.error : console.log;
  let prefix = levelNames[level] + "\t";

  switch (level) {
    case Levels.ERROR:
      prefix = red(prefix);
      break;

    case Levels.INFO:
      prefix = green(prefix);
      break;

    case Levels.DEBUG:
      prefix = yellow(prefix);
      break;
  }

  if (label) {
    prefix += cyan(label) + "\t";
  }

  return (...messageParts) => {
    if (level <= currentLevel) {
      log(prefix + messageParts.join(" "));
    }
  };
}

export const error = createLoggerFn(Levels.ERROR);
export const info = createLoggerFn(Levels.INFO);
export const debug = createLoggerFn(Levels.DEBUG);
export const silly = createLoggerFn(Levels.SILLY);

export const createLabeledLogger = (label: string) => ({
  error: createLoggerFn(Levels.ERROR, label),
  info: createLoggerFn(Levels.INFO, label),
  debug: createLoggerFn(Levels.DEBUG, label),
  silly: createLoggerFn(Levels.SILLY, label),
});
