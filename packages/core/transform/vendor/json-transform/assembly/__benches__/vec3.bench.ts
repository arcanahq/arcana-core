import { JSON } from "..";
import { expect } from "../__tests__/lib";
import { bench } from "./lib/bench";


@json
class Vec3 {
  public x!: i32;
  public y!: i32;
  public z!: i32;
}

const v1: Vec3 = { x: 1, y: 2, z: 3 };
const v2 = '{"x":1,"y":2,"z":3}';

expect(JSON.stringify(v1)).toBe(v2);

bench(
  "Serialize Vec3",
  () => {
    JSON.stringify(v1);
  },
  128_000_00,
);

bench(
  "Deserialize Vec3",
  () => {
    JSON.parse<Vec3>(v2);
  },
  128_000_00,
);
