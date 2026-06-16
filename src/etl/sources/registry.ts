import type { SourceAdapter } from "../sourceAdapter";
import { laCityAdapter } from "./laCity";
import { osmAdapter } from "./osm";
import { osmCandidateHostsAdapter } from "./osmCandidateHosts";

export const sourceAdapters: SourceAdapter[] = [
  laCityAdapter,
  osmAdapter,
  osmCandidateHostsAdapter,
  {
    name: "Long Beach GIS placeholder",
    enabledByDefault: false,
    async fetchRecords() {
      return {
        sourceName: "Long Beach GIS placeholder",
        records: [],
        warnings: [
          "Long Beach GIS is structured as a future adapter because no stable public restroom layer endpoint was confirmed during implementation."
        ]
      };
    }
  }
];
