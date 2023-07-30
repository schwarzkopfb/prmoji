import {
  GITHUB_ACCESS_TOKEN,
  RELEASE_CHECKLIST_HEADING,
  RX_PR_URL,
} from "../const.ts";

const reqInfo = {
  headers: {
    Authorization: "Bearer " + GITHUB_ACCESS_TOKEN,
    Accept: "application/vnd.github.v3+json",
  },
};

/**
 * Status of a PR release checklist check.
 *
 * @property Complete All items in the checklist have been marked as complete.
 * @property Incomplete At least one item in the checklist has not been marked as complete.
 * @property Irrelevant The PR is not a PR for the configured repo, not merged, or does not contain a release checklist.
 */
export enum PrValidationResultStatus {
  Complete = "complete",
  Incomplete = "incomplete",
  Irrelevant = "irrelevant",
}

/**
 * Result of a PR release checklist check.
 *
 * @property status Status of the check.
 * @property user GitHub username of the user who didn't complete the checklist, if any.
 */
export interface PrValidationResult {
  status: PrValidationResultStatus;
  user?: string;
}

/**
 * Scans the PR body for a section titled "Release checklist", and checks if all items in the checklist have been marked as complete.
 *
 * @param url PR URL
 * @returns GitHub username of the user who didn't complete the checklist, or null if the checklist is complete or irrelevant.
 */
export async function validatePr(url: string): Promise<PrValidationResult> {
  const match = url.match(RX_PR_URL);

  if (!match) {
    // not a PR URL
    return { status: PrValidationResultStatus.Irrelevant };
  }

  const [, owner, repo, prNumber] = Array.from(match);
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    reqInfo,
  );
  const { body, user, merged } = await response.json();

  if (!merged) {
    // PR not merged
    return { status: PrValidationResultStatus.Irrelevant };
  }

  const lines = body.split("\n").map((line: string) => line.trim());
  let checklistFound = false;

  for (const line of lines) {
    if (checklistFound) {
      if (line.startsWith("- [ ]")) {
        // skip strikethrough items
        if (!line.includes("~~")) {
          return {
            status: PrValidationResultStatus.Incomplete,
            user: user?.login,
          };
        }
      } // end of checklist (another heading)
      else if (line.startsWith("#")) {
        return { status: PrValidationResultStatus.Complete };
      }
    } else if (line === RELEASE_CHECKLIST_HEADING) {
      checklistFound = true;
    }
  }

  // if no checklist found, we assume it's complete
  return { status: PrValidationResultStatus.Complete };
}

export default validatePr;
