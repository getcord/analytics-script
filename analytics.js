const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const axios = require("axios");
const fs = require("fs");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const colors = require("colors");

const env = dotenv.config().parsed;

if (!env.CUSTOMER_ID) {
  throw new Error("Missing CUSTOMER_ID in .env file");
}

if (!env.CUSTOMER_SECRET) {
  throw new Error("Missing CUSTOMER_SECRET in .env file");
}

const argv = yargs(hideBin(process.argv)).argv;

if (!argv.outputFile) {
  console.error("⛔️ Could not proceed");
  console.error("    Please specify an output file with --outputFile=");
  console.error("      Example: node analytics.js --outputFile=data.csv");
  process.exit(1);
}

async function autoRetry(func) {
  let ret = undefined;
  try {
    ret = await func();
  } catch (e) {
    console.error(e);
    console.error("Retrying once...");
    ret = await func();
  }
  return ret;
}

function makeCustomerToken() {
  return jwt.sign({ customer_id: env.CUSTOMER_ID }, env.CUSTOMER_SECRET, {
    algorithm: "HS512",
    expiresIn: "1 min",
  });
}

function makeServerToken(appID, appSecret) {
  return jwt.sign({ app_id: appID }, appSecret, {
    algorithm: "HS512",
    expiresIn: "90 min",
  });
}

function makeAxiosAuthHeaders(token) {
  return {
    headers: {
      Authorization: "Bearer " + token,
    },
  };
}

const state = { idx: 0, total: 0 };
function log(str) {
  console.log(
    `[${Math.round(1000 * (state.idx / state.total)) / 10}%]`.yellow +
      `[${state.idx} of ${state.total}] `.green +
      str
  );
}

async function listApplications() {
  try {
    const resp = await autoRetry(
      async () =>
        await axios.get(
          "https://api.cord.com/v1/applications",
          makeAxiosAuthHeaders(makeCustomerToken())
        )
    );

    if (resp.status === 200) {
      return resp.data;
    } else {
      throw new Error(
        "Request for applications failed: " +
          resp.status +
          ": " +
          resp.statusText
      );
    }
  } catch (e) {
    console.error(e);
    console.error("⛔️ Failed to list appications. See the error above.");
    process.exit(1);
  }
}

async function getUsers(debugName, token) {
  log("    Fetching " + "users".bold + " for " + debugName);
  const users = [];
  let paginationToken = null;
  const limit = 25000;
  do {
    const resp = await autoRetry(
      async () =>
        await axios.get(
          "https://api.cord.com/v1/users?limit=" +
            encodeURIComponent(limit) +
            (paginationToken !== null
              ? "&token=" + encodeURIComponent(paginationToken)
              : ""),
          makeAxiosAuthHeaders(token)
        )
    );
    if (resp.status === 200) {
      const data = resp.data;
      if (data && typeof data === "object") {
        if ("users" in data && Array.isArray(data.users)) {
          for (let u of data.users) {
            users.push(u);
          }
        } else {
          throw new Error("Request for users was malformed -- no users");
        }

        if (
          "pagination" in data &&
          typeof data.pagination === "object" &&
          data.pagination &&
          "token" in data.pagination &&
          "total" in data.pagination
        ) {
          paginationToken = data.pagination.token;
          log(
            (
              "    Fetched " +
              users.length +
              " users of " +
              data.pagination.total
            ).gray
          );
        } else {
          throw new Error(
            "Malformed pagination data on response for listing users"
          );
        }
      }
    } else {
      console.error(resp);
      throw new Error(
        "Failed to fetch users: " + resp.status + ": " + resp.statusText
      );
    }
  } while (paginationToken !== null);

  return users;
}

async function getGroups(debugName, token) {
  log("    Fetching " + "groups".bold + " for " + debugName);
  const groups = [];
  const resp = await autoRetry(
    async () =>
      await axios.get(
        "https://api.cord.com/v1/groups",
        makeAxiosAuthHeaders(token)
      )
  );
  if (resp.status === 200) {
    const data = resp.data;
    if (data && Array.isArray(data)) {
      for (let g of data) {
        groups.push(g);
      }
    } else {
      throw new Error("Response for groups was malformed -- no groups");
    }
  } else {
    console.error(resp);
    throw new Error(
      "Failed to fetch groups: " + resp.status + ": " + resp.statusText
    );
  }

  return groups;
}

async function getThreads(debugName, token) {
  log("    Fetching " + "threads".bold + " for " + debugName);
  const threads = [];
  let paginationToken = null;
  const limit = 25000;
  do {
    const resp = await autoRetry(
      async () =>
        await axios.get(
          "https://api.cord.com/v1/threads?limit=" +
            encodeURIComponent(limit) +
            (paginationToken !== null
              ? "&token=" + encodeURIComponent(paginationToken)
              : ""),
          makeAxiosAuthHeaders(token)
        )
    );
    if (resp.status === 200) {
      const data = resp.data;
      if (data && typeof data === "object") {
        if ("threads" in data && Array.isArray(data.threads)) {
          for (let t of data.threads) {
            threads.push(t);
          }
        } else {
          throw new Error("Request for threads had no threads");
        }

        if (
          "pagination" in data &&
          typeof data.pagination === "object" &&
          data.pagination &&
          "token" in data.pagination &&
          "total" in data.pagination
        ) {
          paginationToken = data.pagination.token;
          log(
            "    Fetched " +
              threads.length +
              " threads of " +
              data.pagination.total
          );
        } else {
          throw new Error(
            "Malformed pagination data on response for listing threads"
          );
        }
      }
    } else {
      console.error(resp);
      throw new Error(
        "Failed to fetch threads: " + resp.status + ": " + resp.statusText
      );
    }
  } while (paginationToken !== null);

  return threads;
}

async function getMessages(debugName, token) {
  log("    Fetching " + "messages".bold + " for " + debugName);
  const messages = [];
  let paginationToken = null;
  const limit = 1500;
  do {
    const resp = await autoRetry(
      async () =>
        await axios.get(
          "https://api.cord.com/v1/messages?limit=" +
            encodeURIComponent(limit) +
            (paginationToken !== null
              ? "&token=" + encodeURIComponent(paginationToken)
              : ""),
          makeAxiosAuthHeaders(token)
        )
    );
    if (resp.status === 200) {
      const data = resp.data;
      if (data && typeof data === "object") {
        if ("messages" in data && Array.isArray(data.messages)) {
          for (let m of data.messages) {
            messages.push(m);
          }
        } else {
          throw new Error("Request for messages had no messages");
        }

        if (
          "pagination" in data &&
          typeof data.pagination === "object" &&
          data.pagination &&
          "token" in data.pagination &&
          "total" in data.pagination
        ) {
          paginationToken = data.pagination.token;
          log(
            "    Fetched " +
              messages.length +
              " messages of " +
              data.pagination.total
          );
        } else {
          throw new Error(
            "Malformed pagination data on response for listing messages"
          );
        }
      }
    } else {
      console.error(resp);
      throw new Error(
        "Failed to fetch threads: " + resp.status + ": " + resp.statusText
      );
    }
  } while (paginationToken !== null);

  return messages;
}

function countMentionsInMessageContent(arr) {
  let count = 0;
  for (let thing of arr) {
    if (thing && typeof thing === "object") {
      if ("type" in thing && thing.type === "mention") {
        count++;
      }
      if ("children" in thing && Array.isArray(thing.children)) {
        count += countMentionsInMessageContent(thing.children);
      }
    }
  }
  return count;
}

async function generateApplicationAnalytics(debugName, app) {
  if (
    app &&
    typeof app === "object" &&
    "id" in app &&
    typeof app.id === "string" &&
    "secret" in app &&
    typeof app.secret === "string" &&
    "name" in app &&
    typeof app.name === "string"
  ) {
    const serverToken = makeServerToken(app.id, app.secret);
    const [users, groups, threads, messages] = await Promise.all([
      getUsers(debugName, serverToken),
      getGroups(debugName, serverToken),
      getThreads(debugName, serverToken),
      getMessages(debugName, serverToken),
    ]);

    let activeUserCount = 0;
    let deletedUserCount = 0;
    for (let u of users) {
      if (u && typeof u === "object") {
        if (u.status === "active") {
          activeUserCount++;
        } else if (u.status === "deleted") {
          deletedUserCount++;
        }
      }
    }

    let activeGroupCount = 0;
    let deletedGroupCount = 0;
    let slackConnectedGroupCount = 0;
    for (let g of groups) {
      if (g && typeof g === "object") {
        if (g.status === "active") {
          activeGroupCount++;
        } else if (g.status === "deleted") {
          deletedGroupCount++;
        }
        if (g.connectToSlack) {
          slackConnectedGroupCount++;
        }
      }
    }

    let totalResolvedThreadCount = 0;
    let totalMessageCount = 0;
    let totalDeletedMessageCount = 0;
    let totalActionMessagesCount = 0;
    let totalUserMessagesCount = 0;
    const threadParticipants = new Set();
    for (const t of threads) {
      if (t && typeof t === "object") {
        if (t.resolved) {
          totalResolvedThreadCount++;
        }

        if (typeof t.total === "number") {
          totalMessageCount += t.total;
        }

        if (typeof t.actionMessages === "number") {
          totalActionMessagesCount += t.actionMessages;
        }

        if (typeof t.userMessages === "number") {
          totalUserMessagesCount += t.userMessages;
        }

        if (typeof t.deletedMessages === "number") {
          totalDeletedMessageCount += t.deletedMessages;
        }
        if (t.participants && Array.isArray(t.participants)) {
          for (const p of t.participants) {
            if (p && typeof p === "object" && "userID" in p) {
              threadParticipants.add(p.userID);
            }
          }
        }
      }
    }

    let totalMentionMessagesCount = 0;
    let totalReactionsCount = 0;
    let totalAttachmentsCount = 0;
    for (const m of messages) {
      if (m && typeof m === "object") {
        if (m.reactions && Array.isArray(m.reactions)) {
          totalReactionsCount += m.reactions.length;
        }

        if (m.attachments && Array.isArray(m.attachments)) {
          totalAttachmentsCount += m.attachments.length;
        }

        if (m.content && Array.isArray(m.content)) {
          totalMentionMessagesCount += countMentionsInMessageContent(m.content);
        }
      }
    }

    return [
      {
        "Total User Count": users.length,
        "Active User Count": activeUserCount,
        "Deleted User Count": deletedUserCount,
        "Total Group Count": groups.length,
        "Active Group Count": activeGroupCount,
        "Deleted Group Count": deletedGroupCount,
        "Slack Connected Group Count": slackConnectedGroupCount,
        "Total Thread Count": threads.length,
        "Total Resolved Thread Count": totalResolvedThreadCount,
        "Total Message Count": totalMessageCount,
        "Total Deleted Message Count": totalDeletedMessageCount,
        "Total User Messages Count": totalUserMessagesCount,
        "Total Action Messages Count": totalActionMessagesCount,
        "Total Thread Participants Count": threadParticipants.size,
        "Total Messages": messages.length,
        "Total Mention Messages Count": totalMentionMessagesCount,
        "Total Reactions Count": totalReactionsCount,
        "Total Attachments Count": totalAttachmentsCount,
      },
    ];
  } else {
    throw new Error(
      "Application is missing required fields: name, id, and secret"
    );
  }
}

async function main() {
  const applications = await listApplications();

  if (applications && Array.isArray(applications)) {
    const applicationData = [];
    state.total = applications.length;
    for (let application of applications) {
      if (application && typeof application === "object") {
        state.idx++;
        if (
          application.id === "923ecd44-198f-49a2-a4f5-96f69c3d148b" ||
          application.id === "aeb2797f-f0a3-485c-a317-4986e2c8343b"
        ) {
          continue;
        }
        const debugName = application.name + " " + ("" + application.id).gray;
        log(`Generating analytics for app ${debugName}`);
        try {
          applicationData.push([
            application.id,
            application.name,
            ...(await generateApplicationAnalytics(debugName, application)),
          ]);
        } catch (e) {
          console.error(e);
          console.error(
            `⛔️ Failed to generate analytics for appication with ID ${application.id}. See the error above.`
          );
          process.exit(1);
        }
      } else {
        console.error(
          "⛔️ Malformed application object when requesting the application list"
        );
        process.exit(1);
      }
    }
    let output = [];
    const keys = Object.keys(applicationData[0][2]);
    output.push(["ID", "Name", ...keys].join(","));

    for (const app of applicationData) {
      const row = [app[0], app[1]];
      for (const k of keys) {
        row.push(app[2][k]);
      }
      output.push(row.join(","));
    }
    const outString = output.join("\n") + "\n";
    try {
      fs.writeFileSync(argv.outputFile, outString);
    } catch (e) {
      console.error(e);
      console.error("⛔️ Failed to write output file. See error above.");
    }
    console.log("✅ CSV file written");
  } else {
    console.error(
      "⛔️ Received an unexpected response when requesting the list of applications"
    );
    process.exit(1);
  }
}

main();
