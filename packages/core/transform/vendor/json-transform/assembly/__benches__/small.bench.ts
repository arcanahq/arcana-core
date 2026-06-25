import { JSON } from "..";
import { expect } from "../__tests__/lib";
import { bench } from "./lib/bench";


@json
class SmallJSON {
  public id!: i32;
  public name!: string;
  public active!: boolean;
}

const v1: SmallJSON = {
  id: 1,
  name: "Small Object",
  active: true,
};
const v2 = '{"id":1,"name":"Small Object","active":true}';

expect(JSON.stringify(v1)).toBe(v2);

bench(
  "Serialize Small Object",
  () => {
    JSON.stringify(v1);
  },
  16_000_00,
);

bench(
  "Deserialize Small Object",
  () => {
    JSON.parse<SmallJSON>(v2);
  },
  16_000_00,
);
