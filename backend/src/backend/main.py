from contextlib import asynccontextmanager
from typing import List

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from .database import create_db_and_tables, get_session, seed_db
from .models import Conversation, Message
from .llm import generate_llm_response


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    seed_db()
    yield


app = FastAPI(lifespan=lifespan)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/conversations/", response_model=Conversation)
def create_conversation(
    conversation: Conversation, session: Session = Depends(get_session)
):
    session.add(conversation)
    session.commit()
    session.refresh(conversation)
    return conversation


@app.get("/conversations/", response_model=List[Conversation])
def read_conversations(
    offset: int = 0, limit: int = 100, session: Session = Depends(get_session)
):
    conversations = session.exec(
        select(Conversation).offset(offset).limit(limit)
    ).all()
    return conversations


@app.get("/conversations/{conversation_id}")
def read_conversation(
    conversation_id: int, session: Session = Depends(get_session)
):
    conversation = session.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return {
        "id": conversation.id,
        "title": conversation.title,
        "created_at": conversation.created_at,
        "messages": [
            {
                "id": msg.id,
                "conversation_id": msg.conversation_id,
                "content": msg.content,
                "role": msg.role,
                "created_at": msg.created_at
            }
            for msg in conversation.messages
        ]
    }

# get msg from them -> get historical msg -> feed to LLM > get answer -> get back to me
@app.post("/conversations/{conversation_id}/messages/")
def create_message(
    conversation_id: int, message: Message, session: Session = Depends(get_session)
):
    conversation = session.get(Conversation, conversation_id)
    message.conversation_id = conversation_id
    session.add(message)
    session.commit()
    session.refresh(message)

    all_messages = conversation.messages
    llm_messages = [{"role": msg.role, "content": msg.content} for msg in all_messages]

    llm_response_content = generate_llm_response(llm_messages)

    assistant_message = Message(
        conversation_id=conversation_id,
        role="assistant",
        content=llm_response_content
    )
    session.add(assistant_message)
    session.commit()
    session.refresh(assistant_message)

    return {
        "user_message": {
            "id": message.id,
            "conversation_id": message.conversation_id,
            "content": message.content,
            "role": message.role,
            "created_at": message.created_at
        },
        "assistant_message": {
            "id": assistant_message.id,
            "conversation_id": assistant_message.conversation_id,
            "content": assistant_message.content,
            "role": assistant_message.role,
            "created_at": assistant_message.created_at
        }
    }


@app.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: int, session: Session = Depends(get_session)
):
    conversation = session.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    session.delete(conversation)
    session.commit()
    return {"ok": True}