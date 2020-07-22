import * as dayjs from "dayjs";
import { number } from "prop-types";

// Typescript's Record type assumes every key has a value, which is usually not true
type Dictionary<K extends string | number, V> = Partial<Record<K, V>>;

// Map from line ID to full line string
type PIALineMap = Dictionary<number, string>;

class PIADate extends Date {}

class PIAMonthYear extends Date {}

class PIAYear extends Number {}
class PIAEarnings extends Number {}

interface PIASerializer {
  fieldFormats: Record<string, PIAFieldMeta>;
  serialize: (data: Partial<PIAData>) => PIALineMap;
  deserialize: (lineMap: PIALineMap) => Partial<PIAData>;
}

class PIAFieldMeta {
  startChar: number;
  endChar: number;
  startLine: number;
  endLine: number;
  fieldCharLength: number;
  constructor() {
    this.startChar = -1;
    this.endChar = -1;
    this.startLine = -1;
    this.endLine = -1;
    this.fieldCharLength = -1;
  }
  setStartChar(start: umber): PIAFieldMeta {
    this.startChar = start;
    return this;
  }

  setEndChar(end: number): PIAFieldMeta {
    this.endChar = end;
    return this;
  }

  setStartLine(start: number): PIAFieldMeta {
    this.startLine = start;
    return this;
  }
  setEndLine(end: number): PIAFieldMeta {
    this.endLine = end;
    return this;
  }

  setFieldCharLength(len: number): PIAFieldMeta {
    this.fieldCharLength = len;
    return this;
  }
  getBlank(): string {
    let len = this.endChar === -1 ? 0 : this.endChar - this.startChar + 1;
    return " ".repeat(len);
  }
}

/*
return ['01', this.ssn, this.sex, dayjs(this.birthDate).format("MMDDYYYY"),'\n', this.piaEverythingElse.join('\n')].join('');
*/
const basicInfoSerializer: PIASerializer = new (class {
  fieldFormats: Record<string, PIAFieldMeta>;
  constructor() {
    this.fieldFormats = {
      ssn: new PIAFieldMeta().setStartChar(3).setEndChar(11),
      birthDate: new PIAFieldMeta().setStartChar(13).setEndChar(20),
      dateOfDeath: new PIAFieldMeta().setStartChar(3).setEndChar(10),
      sex: new PIAFieldMeta().setStartChar(12).setEndChar(12),
    };
  }

  serialize(data: Partial<PIAData>): PIALineMap {
    const line01 = {
      1: `01${
        data.ssn != undefined ? data.ssn : this.fieldFormats.ssn.getBlank()
      }${data.sex != undefined ? data.sex : " "}${
        data.birthDate != undefined
          ? formatPIAMonthStr(data.birthDate)
          : this.fieldFormats.birthDate.getBlank()
      }`,
    };
    const line02 = {
      2: `02${
        data.dateOfDeath != undefined
          ? formatPIAMonthStr(data.dateOfDeath)
          : this.fieldFormats.dateOfDeath.getBlank()
      }`,
    };

    return { ...line01, ...line02 };
  }
  deserialize(lineMap: PIALineMap): Partial<PIAData> {
    const line01Str = lineMap[1];
    const line02Str = lineMap[2];

    const line01Data = line01Str
      ? {
          ssn: parsePiaString(
            line01Str,
            this.fieldFormats.ssn.startChar,
            this.fieldFormats.ssn.endChar
          ),
          birthDate: parsePiaDate(
            line01Str,
            this.fieldFormats.birthDate.startChar,
            this.fieldFormats.birthDate.endChar
          ),
          sex: parsePiaSex(
            line01Str,
            this.fieldFormats.sex.startChar,
            this.fieldFormats.sex.endChar
          ),
        }
      : {};

    const line02Data = line02Str
      ? {
          // Maybe don't even need the end index? If all dates have the same length
          dateOfDeath: parsePiaDate(line02Str, 3, 10),
        }
      : {};
    return { ...line01Data, ...line02Data };
  }
})();

const benefitSerializer: PIASerializer = new (class {
  fieldFormats: Record<string, PIAFieldMeta>;
  constructor() {
    this.fieldFormats = {
      typeOfBenefit: new PIAFieldMeta().setStartChar(3).setEndChar(3),
      monthYearEntitlement: new PIAFieldMeta().setStartChar(4).setEndChar(9),
      monthYearBenefit: new PIAFieldMeta().setStartChar(3).setEndChar(8),
    };
  }
  serialize(data: Partial<PIAData>): PIALineMap {
    const line03 = {
      3: `03${
        data.typeOfBenefit != undefined
          ? data.typeOfBenefit
          : this.fieldFormats.typeOfBenefit.getBlank()
      }${
        data.monthYearEntitlement != undefined
          ? formatPIAMonthStr(data.monthYearEntitlement)
          : this.fieldFormats.monthYearEntitlement.getBlank()
      }`,
    };
    const line04 = {
      4: `04${
        data.monthYearBenefit != undefined
          ? formatPIAMonthStr(data.monthYearBenefit)
          : this.fieldFormats.monthYearBenefit.getBlank()
      }`,
    };

    return { ...line03, ...line04 };
  }
  deserialize(lineMap: PIALineMap): Partial<PIAData> {
    let line03 = lineMap[3];
    let line04 = lineMap[4];

    let line03Data = line03
      ? {
          typeOfBenefit: parseSSABenefitType(
            line03,
            this.fieldFormats.typeOfBenefit.startChar,
            this.fieldFormats.typeOfBenefit.endChar
          ),
          monthYearEntitlement: parsePiaMonthYear(
            line03,
            this.fieldFormats.monthYearEntitlement.startChar,
            this.fieldFormats.monthYearEntitlement.endChar
          ),
        }
      : {};
    let line04Data = line04
      ? {
          monthYearEntitlement: parsePiaMonthYear(
            line04,
            this.fieldFormats.monthYearEntitlement.startChar,
            this.fieldFormats.monthYearEntitlement.endChar
          ),
        }
      : {};
    return { ...line03Data, ...line04Data };
  }
})();

/*
OASDI stands for old age, survivors, and disability insurance tax,
and the money that your employer collects goes to the federal government
 in order to fund the Social Security program.
return 
*/
const oasdiEarningsSerializer: PIASerializer = new (class {
  fieldFormats: Record<string, PIAFieldMeta>;

  // all start at 3 and continue for number of entries based on other values.
  constructor() {
    this.fieldFormats = {
      firstEarningYearActual: new PIAFieldMeta().setStartChar(3).setEndChar(6),
      lastEarningYearActual: new PIAFieldMeta().setStartChar(7).setEndChar(10),
      typeOfEarnings: new PIAFieldMeta().setStartChar(3).setFieldCharLength(1), //TODO: use fieldCharLength with generic
      typeOfTaxes: new PIAFieldMeta().setStartChar(3),
      oasdiEarnings: new PIAFieldMeta()
        .setStartChar(3)
        .setStartLine(22)
        .setEndLine(29)
        .setFieldCharLength(11),
      hiEarnings: new PIAFieldMeta()
        .setStartChar(3)
        .setStartLine(30)
        .setEndLine(37)
        .setFieldCharLength(11),
    };
  }

  serialize(data: Partial<PIAData>): PIALineMap {
    return;
  }
  deserialize(lineMap: PIALineMap): Partial<PIAData> {
    const line6Str = lineMap[6];
    const line20Str = lineMap[20];
    const line21Str = lineMap[21];
    const line22Str = lineMap[22];
    var oasdiLine: string;

    const line6Data = line6Str
      ? {
          firstEarningYearActual: parseInt(
            piaSubstr(
              line6Str,
              this.fieldFormats.firstEarningYearActual.startChar,
              this.fieldFormats.firstEarningYearActual.endChar || 0 //TODO: handle undefined
            ),
            10
          ),
          lastEarningYearActual: parseInt(
            piaSubstr(
              line6Str,
              this.fieldFormats.lastEarningYearActual.startChar,
              this.fieldFormats.lastEarningYearActual.endChar || 0 //TODO: handle undefined
            ),
            10
          ),
        }
      : {};

    var lineYear = line6Data.firstEarningYearActual || 1950; //TODO: remove stub, calculate from line7 AND line 6.
    oasdiLine = "";
    var oasdiData: Map<PIAYear, PIAEarnings> = new Map<PIAYear, PIAEarnings>();
    for (
      var i = this.fieldFormats.oasdiEarnings.startLine;
      i <= this.fieldFormats.oasdiEarnings.endLine;
      i++
    ) {
      if (lineMap[i] == "") {
        break;
      } else {
        oasdiLine = lineMap[i] || "";
        oasdiLine = oasdiLine.trim();
        debugger
        const parsedLine = parseYearEarningsLineString(
          oasdiLine,
          this.fieldFormats.oasdiEarnings.startChar,
          lineYear,
          this.fieldFormats.oasdiEarnings.fieldCharLength
        );
        oasdiData = new Map<PIAYear, PIAEarnings>([...Array.from(oasdiData.entries()),...Array.from(parsedLine.entries())])
        // ([...oasdiData, ...parsedLine ]);
        lineYear = lineYear +=
          Math.floor(oasdiLine.length / this.fieldFormats.oasdiEarnings.fieldCharLength);
      }
    }

    let line22To29Data: Partial<PIAData> = {
      oasdiEarnings: oasdiData,
    };

    const line20Data = line20Str
      ? {
          typeOfEarnings: parsePiaTypeOfEarningsString(
            line20Str,
            this.fieldFormats.typeOfEarnings.startChar,
            line6Data.firstEarningYearActual || 1950 //TODO: remove stub, calculate from line7 AND line 6.
          ),
        }
      : {};

    console.log({ ...line6Data, ...line20Data, ...line22To29Data })

    return { ...line6Data, ...line20Data, ...line22To29Data };
  }
})();

const PIA_SERIALIZERS: PIASerializer[] = [
  basicInfoSerializer,
  benefitSerializer,
  oasdiEarningsSerializer,
  // dateOfDeathSerializer,
  // disabilityDatesSerializer,
  //…
];

/**
 * Given a list of lines in the AnyPIA format, return a map from
 * line number to the line string itself.
 */
function createLineMap(lines: string[]): PIALineMap {
  return lines.reduce((lineMap, line) => {
    const lineNum = parseInt(line.slice(0, 2), 10);
    return Object.assign(lineMap, { [lineNum]: line });
  }, {});
}

function deserializePIAData(lines: string[]): PIAData {
  const lineMap = createLineMap(lines);
  const deserializedData = PIA_SERIALIZERS.reduce(
    (data, serializer) => Object.assign(data, serializer.deserialize(lineMap)),
    {}
  );

  return deserializedData;
}

function serializePIAData(data: PIAData): PIALineMap {
  const lines = PIA_SERIALIZERS.reduce(
    (lineMap, serializer) => Object.assign(lineMap, serializer.serialize(data)),
    {}
  );
  return lines;
}

enum PIASex {
  male = 0,
  female = 1,
}

enum SSABenefitType {
  old_age = 1,
  survivor = 2,
  disability = 3,
}

/* http://thadk.net/anypiamac-docs/html/Forms/type_of_earnings.html */
enum PIATypeOfEarnings {
  entered_earnings = 0,
  maximum = 1,
  high = 2,
  average = 3,
  low = 4,
}

enum PIATypeOfTaxes {
  employee_taxes = 0,
  self_employed_taxes = 1,
}

interface PIAData {
  ssn?: string;
  birthDate?: PIADate;
  dateOfDeath?: PIADate;
  sex?: PIASex;
  typeOfBenefit?: SSABenefitType;
  monthYearBenefit?: PIAMonthYear;
  monthYearEntitlement?: PIAMonthYear;
  firstEarningYearActual?: PIAYear;
  lastEarningYearActual?: PIAYear;
  typeOfEarnings?: Map<PIAYear, PIATypeOfEarnings>;
  typeOfTaxes?: Map<PIAYear, PIATypeOfTaxes>;
  oasdiEarnings?: Map<PIAYear, PIAEarnings>;
  piaEverythingElse?: string;
}

export class PiaFormat {
  piaAll: string;
  piaData: PIAData;
  constructor(piaInput: string, fileName: string) {
    this.piaAll = piaInput;
    const lines = piaInput.split("\n");
    this.piaData = deserializePIAData(lines);
  }

  outputPIA() {
    var lines = serializePIAData(this.piaData);

    return lines;
  }
}
function piaSubstr(str: string, start: number, end: number): string {
  let start_pos = start - 1;
  let str_len = end - start + 1;
  return str.substr(start_pos, str_len);
}

function parsePiaString(str: string, start: number, end: number): string {
  return piaSubstr(str, start, end);
}

function parsePiaMonthYear(
  lineStr: string,
  start: number,
  end: number
): PIAMonthYear {
  let ymStr = piaSubstr(lineStr, start, end);
  var djs = dayjs();
  let year = ymStr.slice(0, 2);
  let month = ymStr.slice(2);
  djs
    .set("month", parseInt(month, 10))
    .set("year", parseInt(year, 10))
    .set("day", 1);
  var piaMonth: PIAMonthYear = djs.toDate();
  return piaMonth;
}

function parsePiaSex(lineStr: string, start: number, end: number): PIASex {
  let genderStr = piaSubstr(lineStr, start, end);
  let genInt = parseInt(genderStr, 10);
  let sex: PIASex = genInt;
  return sex;
}

function parseSSABenefitType(
  lineStr: string,
  start: number,
  end: number
): SSABenefitType {
  let benStr = piaSubstr(lineStr, start, end);
  let benInt = parseInt(benStr, 10);
  let ssaBen: SSABenefitType = benInt;
  return ssaBen;
}

function parseYearEarningsLineString(
  lineStr: string,
  startCharacter: number,
  startYear: PIAYear,
  dataEntryLength: number
): Map<PIAYear, PIAEarnings> {
  let yrDataMap = new Map<PIAYear, PIAEarnings>();
  const zeroIndexStartChar = startCharacter - 1;
  let currentYear = Number(startYear);
  for (var i = zeroIndexStartChar; i < lineStr.length; i += dataEntryLength) {
    let val: PIAEarnings = parsePiaCurrency(lineStr.substr(i, dataEntryLength));
    yrDataMap.set(currentYear, val);
    currentYear = currentYear + 1;
  }
  return yrDataMap;
}

function parsePiaTypeOfEarningsString(
  lineStr: string,
  startCharacter: number,
  startYear: PIAYear
): Map<PIAYear, PIATypeOfEarnings> {
  let toeMap = new Map<PIAYear, PIATypeOfEarnings>();
  const zeroIndexStartCharacter = startCharacter - 1;

  let currentYear = Number(startYear);
  for (var i = zeroIndexStartCharacter; i < lineStr.length; i++) {
    let val: PIATypeOfEarnings = parseInt(lineStr.charAt(i), 10);
    toeMap.set(currentYear, val);
    currentYear = currentYear + 1;
  }
  return toeMap;
}

function parsePiaDate(lineStr: string, start: number, end: number): PIADate {
  var djs = dayjs();
  let ymdStr = piaSubstr(lineStr, start, end);
  let year = ymdStr.slice(0, 2);
  let month = ymdStr.slice(2, 4);
  let day = ymdStr.slice(4);
  /* dayjs will use local timezone */
  /* starts in mmddyyyy */
  djs
    .set("month", parseInt(month, 10))
    .set("year", parseInt(year, 10))
    .set("date", parseInt(day, 10));
  let piaDate: PIADate = djs.toDate();
  return piaDate;
}

//Parces a pia currency values
function parsePiaCurrency(val: string): Number {
  val = val.replace(".", "");
  return parseInt(val) / 100.0;
}

function parsePiaFloat(val: string): Number {
  return parseFloat(val);
}

function formatPIADateStr(date: PiaDate): string {
  return dayjs(date).format("MMDDYYYY");
}

function formatPIAMonthStr(monthYear: PIAMonthYear): string {
  return dayjs(monthYear).format("MMYYYY");
}
