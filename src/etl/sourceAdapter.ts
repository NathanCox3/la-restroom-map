import type { SourceAdapterResult } from "../shared/types";

export interface SourceAdapter {
  name: string;
  enabledByDefault: boolean;
  fetchRecords: () => Promise<SourceAdapterResult>;
}
