// Thai bank codes (Bank of Thailand), used for bank-account QR codes.
export const THAI_BANKS = [
  { code: "006", name: "ธนาคารกรุงไทย" },
  { code: "002", name: "ธนาคารกรุงเทพ" },
  { code: "004", name: "ธนาคารกสิกรไทย" },
  { code: "014", name: "ธนาคารไทยพาณิชย์" },
  { code: "025", name: "ธนาคารกรุงศรีอยุธยา" },
  { code: "011", name: "ธนาคารทหารไทยธนชาต" },
  { code: "030", name: "ธนาคารออมสิน" },
  { code: "034", name: "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร" },
  { code: "033", name: "ธนาคารอาคารสงเคราะห์" },
  { code: "024", name: "ธนาคารยูโอบี" },
  { code: "022", name: "ธนาคารซีไอเอ็มบี ไทย" },
  { code: "069", name: "ธนาคารเกียรตินาคินภัทร" },
  { code: "067", name: "ธนาคารทิสโก้" },
  { code: "073", name: "ธนาคารแลนด์ แอนด์ เฮ้าส์" },
  { code: "066", name: "ธนาคารอิสลามแห่งประเทศไทย" },
] as const;

export const bankByCode = (code: string | null | undefined) => THAI_BANKS.find((bank) => bank.code === code) ?? null;
