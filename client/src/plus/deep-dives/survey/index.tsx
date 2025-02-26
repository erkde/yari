import React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import useSWR from "swr";

import "./index.scss";

const API_URL = "/api/v1/plus/landing-page/survey/";
const SESSIONSTORAGE_KEY_UUID = "plus-landing-page-survey-uuid";

interface PingData {
  csrfmiddlewaretoken: string;
  uuid: string;
}

interface ResponseData {
  usage?: string;
  pfbs?: string;
  pfbsMotivation?: string;
  ybst?: string;
  ybstMotivation?: string;
  futureTopics?: string[];
  futureTopicsSuggestions?: string;
  comments?: string;
}

const SESSION_KEY = "market-research-survey-page";

function setSessionStorageData(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch (err) {
    console.warn("Unable to set sessionStorage key");
  }
}

function getSessionStorageData(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch (err) {
    console.warn("Unable to get sessionStorage key");
  }
}

export function Survey({
  slug,
  hasFinished,
}: {
  slug: string;
  hasFinished: () => void;
}) {
  const { locale } = useParams();
  const [searchParams] = useSearchParams();
  const previousPage = getSessionStorageData(SESSION_KEY) || "";
  const [page, setPage] = React.useState<"start" | "success">(
    previousPage === "success" ? "success" : "start"
  );

  React.useEffect(() => {
    if (page !== "start") {
      setSessionStorageData(SESSION_KEY, page);
    }
    if (page === "success") {
      hasFinished();
    }
  }, [page, hasFinished]);

  const [surveySubmissionError, setSurveySubmissionError] =
    React.useState<Error | null>(null);

  const [responseData, setResponseData] = React.useState<ResponseData>({});

  const [submitting, setSubmitting] = React.useState(false);

  // Use a useMemo(() => {...}, []) so that you don't get a different
  // response if there's a re-render because in a re-render you might get
  // something different (from the first render) from getSessionStorageData().
  const pingURL = React.useMemo(() => {
    const pingSP = new URLSearchParams();
    const previousUUID = getSessionStorageData(SESSIONSTORAGE_KEY_UUID);
    if (previousUUID) {
      pingSP.set("uuid", previousUUID);
    }
    return `${API_URL}?${pingSP.toString()}`;
  }, []);

  const { data: pingData, error: pingError } = useSWR<PingData>(
    pingURL,
    async (url) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`${response.status} on ${url}`);
      }
      return await response.json();
    },
    {
      revalidateOnFocus: false,
    }
  );

  React.useEffect(() => {
    if (pingData) {
      setSessionStorageData(SESSIONSTORAGE_KEY_UUID, pingData.uuid);
    }
  }, [pingData]);

  async function submitSurvey() {
    if (!pingData) {
      throw new Error("Can't send survey if ping didn't work");
    }

    const formData = new URLSearchParams();
    formData.set(
      "response",
      JSON.stringify(
        Object.assign(
          { slug },
          { querystring: searchParams.toString() },
          responseData
        )
      )
    );
    formData.set("uuid", pingData.uuid);

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "X-CSRFToken": pingData.csrfmiddlewaretoken,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`${response.status} on ${API_URL}`);
    }
    return response;
  }

  if (!pingData && !pingError) {
    // Still loading
    return null;
  }

  return (
    <div className="survey-wrapper">
      {pingError && (
        <div className="girdle">
          <p>
            <b>Oh no!</b> Unable to connect to the server to prepare your
            survey.
          </p>
          <p>Refresh the page or try again later.</p>
        </div>
      )}

      {surveySubmissionError && (
        <div className="girdle">
          <p>
            <b>Oh no!</b> Your survey submission unfortunately failed.
          </p>
          <p>Refresh the page or try again later.</p>
        </div>
      )}

      {page === "success" && (
        <h3 className="survey-success">Thank you for your feedback!</h3>
      )}

      {page !== "success" && !pingError && (
        <form
          id="survey-form"
          name="survey-form"
          action=""
          method="post"
          className="survey-container girdle"
          onSubmit={async (event) => {
            event.preventDefault();
            setSubmitting(true);
            try {
              await submitSurvey();
              setPage("success");
            } catch (error) {
              setSurveySubmissionError(error);
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {page === "start" && (
            <fieldset className="survey-section">
              <legend className="survey-heading">
                Please help us by answering some questions
              </legend>
              <div className="survey-question">
                <h3>How often do you use MDN?</h3>
                <div className="form-radio-input-group">
                  {[
                    ["daily", "Every day"],
                    ["weekly", "Weekly"],
                    ["biweekly", "Every few weeks"],
                    ["never", "I do not use MDN"],
                  ].map(([id, label]) => {
                    return (
                      <label key={id} htmlFor={`id_${id}`}>
                        <input
                          id={`id_${id}`}
                          type="radio"
                          name="mdn-usage"
                          value={id}
                          checked={responseData.usage === id}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setResponseData((state) =>
                                Object.assign({}, state, {
                                  usage: event.target.value,
                                })
                              );
                            }
                          }}
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>
              <h3>How would you rate the articles?</h3>
              <div className="survey-question">
                <h4>
                  Article 1:{" "}
                  <a
                    href={`/${locale}/plus/deep-dives/planning-for-browser-support`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Planning for browser support
                  </a>
                </h4>
                <div className="form-radio-input-group">
                  {[
                    ["pfbs-not-read", "Didn’t read"],
                    ["pfbs-bad", "Bad"],
                    ["pfbs-neutral", "Neutral"],
                    ["pfbs-good", "Good"],
                    ["pfbs-very-good", "Very good"],
                  ].map(([id, label]) => {
                    return (
                      <label key={id} htmlFor={`id_${id}`}>
                        <input
                          id={`id_${id}`}
                          type="radio"
                          name="pfbs"
                          value={id}
                          checked={responseData.pfbs === id}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setResponseData((state) =>
                                Object.assign({}, state, {
                                  pfbs: event.target.value,
                                })
                              );
                            }
                          }}
                          required
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
                <div className="form-input-group">
                  <label htmlFor="pfbs-motivation" className="visually-hidden">
                    What motivated your selection?
                  </label>
                  <input
                    id="pfbs-motivation"
                    type="text"
                    value={responseData.pfbsMotivation || ""}
                    placeholder="What motivated your selection?"
                    onChange={(event) => {
                      setResponseData((state) =>
                        Object.assign({}, state, {
                          pfbsMotivation: event.target.value,
                        })
                      );
                    }}
                  />
                </div>
              </div>
              <div className="survey-question">
                <h4>
                  Article 2:{" "}
                  <a
                    href={`/${locale}/plus/deep-dives/your-browser-support-toolkit`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Your browser support toolkit
                  </a>
                </h4>
                <div className="form-radio-input-group">
                  {[
                    ["not-read", "Didn’t read"],
                    ["bad", "Bad"],
                    ["neutral", "Neutral"],
                    ["good", "Good"],
                    ["very-good", "Very good"],
                  ].map(([id, label]) => {
                    return (
                      <label key={id} htmlFor={`id_${id}`}>
                        <input
                          id={`id_${id}`}
                          type="radio"
                          name="ybst"
                          value={id}
                          checked={responseData.ybst === id}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setResponseData((state) =>
                                Object.assign({}, state, {
                                  ybst: event.target.value,
                                })
                              );
                            }
                          }}
                          required
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
                <div className="form-input-group">
                  <label htmlFor="ybst-motivation" className="visually-hidden">
                    What motivated your selection?
                  </label>

                  <input
                    id="ybst-motivation"
                    type="text"
                    value={responseData.ybstMotivation || ""}
                    placeholder="What motivated your selection?"
                    onChange={(event) => {
                      setResponseData((state) =>
                        Object.assign({}, state, {
                          ybstMotivation: event.target.value,
                        })
                      );
                    }}
                  />
                </div>
              </div>
              <div className="button-container">
                <button
                  type="submit"
                  className="button primary"
                  disabled={submitting}
                >
                  {submitting ? "Submitting" : "Submit"}
                </button>
              </div>
            </fieldset>
          )}
        </form>
      )}
    </div>
  );
}
