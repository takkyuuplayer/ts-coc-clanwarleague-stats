import fs from "fs";
import { Coc } from "../src/coc";

describe("coc", () => {
  const leaguegroup = JSON.parse(
    fs.readFileSync("test/data/coc-currenwar-leaguegroup.json", {
      encoding: "utf8",
    })
  );

  describe(".createSpreadsheetRequestBody", () => {
    const requestBody = Coc.createSpreadsheetRequestBody(
      "#29UQ0802V",
      leaguegroup
    );
    it("should return a request body to create a new spreadsheet", () => {
      expect(requestBody.properties?.title).toBe(
        "終わりなき旅 (#29UQ0802V) / 2020-09"
      );
    });
  });
  describe(".initializeSummarySheetRequestBody", () => {
    const requestBody = Coc.initializeSummarySheetRequestBody(leaguegroup);

    it("should return a request body to initialize the sumary sheet's values", () => {
      expect(requestBody.data!.length).toBe(1);
      expect(requestBody.data![0].range).toBe("Summary!A1:P9");
    });
  });
  describe(".initializeClanSheetRequestBody", () => {
    const requestBody = Coc.initializeClanSheetRequestBody(leaguegroup);

    it("should return a request body to initialize clan sheets' values", () => {
      expect(requestBody.data![0].range).toBe("終わりなき旅!A1:L50");
      expect(requestBody.data!.length).toBe(8);
    });
  });
});
