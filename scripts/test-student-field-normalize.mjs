#!/usr/bin/env node
import {
  normalizeEmail,
  normalizePhone,
  universityRollCompositeKey,
} from "../api/lib/studentFieldNormalize.ts";

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

assert(normalizeEmail(" Student@Example.com ") === "student@example.com", "email normalize");
assert(normalizePhone("+91 98765 43210") === "9876543210", "phone normalize");
assert(universityRollCompositeKey("BNMU", "12345") === "bnmu|12345", "roll composite");
console.log("studentFieldNormalize checks passed");
