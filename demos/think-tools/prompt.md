<!-- Generated from the feature's index.tsx by shared/llm/prompt.ts. Do not edit by hand. -->
# Add Tool calling on /v1/think to a web app with Deepgram

Ask about store hours or an order. The model asks this page to run a tool, the page answers with fake data, and the model replies from it. Every round is shown as sent.

Build a page that sends a message to a Deepgram LLM, with `tools` set as below, and shows the
reply. Live demo: https://dg-devrel-demos.fly.dev/demos/think-tools/

Deepgram LLMs are in Early Access: the project must be enrolled, and fields can change before GA.

## The request

Every request here is sent to the live API before this file ships. The endpoint takes these
top-level fields only: `model`, `messages`, `temperature`, `reasoning_effort`, `tools`, `stream`,
`stream_options`, `mip_opt_out`. Anything else (`max_tokens`, `top_p`, `tool_choice`) is a 400.

```http
POST https://agent.deepgram.com/v1/think
Authorization: Bearer <token>
Content-Type: application/json

{
  "model": "think-fast",
  "messages": [
    {
      "role": "system",
      "content": "You are a support agent for a store chain. Use the tools to answer questions about store hours and orders. Keep replies to one or two sentences."
    },
    {
      "role": "user",
      "content": "Is the Austin store open on Saturday?"
    }
  ],
  "temperature": 0,
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_store_hours",
        "description": "Get the opening hours of a store location for a given day. Call this when the customer asks when a store is open.",
        "parameters": {
          "type": "object",
          "properties": {
            "city": {
              "type": "string",
              "description": "The city of the store, such as Austin."
            },
            "day": {
              "type": "string",
              "description": "The day of the week, such as Saturday."
            }
          },
          "required": [
            "city",
            "day"
          ]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "check_order_status",
        "description": "Look up the shipping status of an order. Call this when the customer gives an order number.",
        "parameters": {
          "type": "object",
          "properties": {
            "order_id": {
              "type": "string",
              "description": "The order number, such as A1234."
            }
          },
          "required": [
            "order_id"
          ]
        }
      }
    }
  ]
}
```

## Keep the API key on your server

The browser never sees `DEEPGRAM_API_KEY`. Add one server route, `GET /api/token`, that asks
Deepgram for a short-lived token and returns it as plain text:

```http
POST https://api.deepgram.com/v1/auth/grant
Authorization: Token <DEEPGRAM_API_KEY>
Content-Type: application/json

{"ttl_seconds": 30}
```

The response is JSON with `access_token`. Refuse the route to other sites: answer 403 when
`Sec-Fetch-Site` is present and not `same-origin`. In the browser, fetch a fresh token for every
request and send it as `Authorization: Bearer <token>`. Deepgram allows these requests from a
browser (CORS), so no proxy is needed.

## Read the reply

The response is a `chat.completion`: the reply is `choices[0].message.content`, and `usage` has
`prompt_tokens`, `completion_tokens`, and (Think-Fast) `completion_tokens_details.reasoning_tokens`.

## Answer tool calls

When the reply's message has `tool_calls` (and `finish_reason` is `"tool_calls"`), run each one in
your app, then send the request again with the same `tools`, the assistant message appended as it
came back, and one `tool` message per call with your result, JSON-encoded, and the call's `id`.
`function.arguments` is a JSON string: parse it. For the text below the model calls
`get_store_hours` with `{"city":"Austin","day":"Saturday"}`, and the follow-up looks like this:

```http
POST https://agent.deepgram.com/v1/think
Authorization: Bearer <token>
Content-Type: application/json

{
  "model": "think-fast",
  "messages": [
    {
      "role": "system",
      "content": "You are a support agent for a store chain. Use the tools to answer questions about store hours and orders. Keep replies to one or two sentences."
    },
    {
      "role": "user",
      "content": "Is the Austin store open on Saturday?"
    },
    {
      "role": "assistant",
      "content": null,
      "tool_calls": [
        {
          "id": "call_1",
          "type": "function",
          "function": {
            "name": "get_store_hours",
            "arguments": "{\"city\":\"Austin\",\"day\":\"Saturday\"}"
          }
        }
      ]
    },
    {
      "role": "tool",
      "tool_call_id": "call_1",
      "content": "{\"city\":\"Austin\",\"day\":\"Saturday\",\"open\":\"9:00 AM\",\"close\":\"8:00 PM\"}"
    }
  ],
  "temperature": 0,
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_store_hours",
        "description": "Get the opening hours of a store location for a given day. Call this when the customer asks when a store is open.",
        "parameters": {
          "type": "object",
          "properties": {
            "city": {
              "type": "string",
              "description": "The city of the store, such as Austin."
            },
            "day": {
              "type": "string",
              "description": "The day of the week, such as Saturday."
            }
          },
          "required": [
            "city",
            "day"
          ]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "check_order_status",
        "description": "Look up the shipping status of an order. Call this when the customer gives an order number.",
        "parameters": {
          "type": "object",
          "properties": {
            "order_id": {
              "type": "string",
              "description": "The order number, such as A1234."
            }
          },
          "required": [
            "order_id"
          ]
        }
      }
    }
  ]
}
```

The endpoint is stateless: every request carries the whole conversation. Stop after a few rounds
if the model keeps calling tools.

## Try it

Send:

> Is the Austin store open on Saturday?

## Done when

- [ ] The page sends the request above, with `tools` exactly as shown.
- [ ] `DEEPGRAM_API_KEY` exists only on the server; the browser uses a token from `/api/token`.
- [ ] Sending the text above makes the model call `get_store_hours`, the page answers, and the reply uses the result.
- [ ] Errors show a sentence that says what to do next, not a stack trace.

Docs: https://developers.deepgram.com/docs/llm/request-response-format
