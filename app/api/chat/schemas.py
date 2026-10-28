from pydantic import BaseModel, Field


class ChatAskRequest(BaseModel):
    message: str = Field(..., description="The user’s question to the assistant")
    plant_context: str | None = Field(
        default=None, description="Context about the plant"
    )


class ChatAskResponse(BaseModel):
    reply: str
    model: str = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"
