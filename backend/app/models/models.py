from datetime import datetime
from typing import Optional
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, JSON, Text, Table
from sqlalchemy.orm import Mapped, relationship
from ..database import Base

candidate_skill_association = Table(
    "candidate_skills",
    Base.metadata,
    Column("candidate_id", String, ForeignKey("bidders.id"), primary_key=True),
    Column("skill_id", String, ForeignKey("skills.id"), primary_key=True),
    Column("confidence", Float, default=0.0),
    Column("verified", Boolean, default=False),
)

job_skill_association = Table(
    "job_skills",
    Base.metadata,
    Column("job_id", String, ForeignKey("tenders.id"), primary_key=True),
    Column("skill_id", String, ForeignKey("skills.id"), primary_key=True),
)

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = Column(String, primary_key=True, index=True)
    email: Mapped[str] = Column(String, unique=True, index=True, nullable=False)
    full_name: Mapped[Optional[str]] = Column(String, nullable=True)
    hashed_password: Mapped[str] = Column(String, nullable=False)
    role: Mapped[str] = Column(String, default="recruiter")
    is_active: Mapped[bool] = Column(Boolean, default=True)
    created_at: Mapped[datetime] = Column(DateTime, default=datetime.utcnow)

class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[str] = Column(String, primary_key=True, index=True)
    name: Mapped[str] = Column(String, unique=True, nullable=False)
    category: Mapped[Optional[str]] = Column(String, nullable=True)

    candidates: Mapped[list["Bidder"]] = relationship(
        "Bidder",
        secondary=candidate_skill_association,
        back_populates="skills",
    )
    jobs: Mapped[list["Tender"]] = relationship(
        "Tender",
        secondary=job_skill_association,
        back_populates="target_skills",
    )

class Tender(Base):
    __tablename__ = "tenders"

    id: Mapped[str] = Column(String, primary_key=True, index=True)
    title: Mapped[str] = Column(String)
    department: Mapped[str] = Column(String)
    upload_date: Mapped[datetime] = Column(DateTime, default=datetime.utcnow)
    status: Mapped[str] = Column(String, default="pending")
    value: Mapped[str] = Column(String)
    document_path: Mapped[Optional[str]] = Column(String, nullable=True)
    file_hash: Mapped[Optional[str]] = Column(String, nullable=True)
    required_docs: Mapped[Optional[list]] = Column(JSON)
    is_signed: Mapped[bool] = Column(Boolean, default=False)
    signed_by: Mapped[Optional[str]] = Column(String, nullable=True)
    signed_at: Mapped[Optional[datetime]] = Column(DateTime, nullable=True)
    description_text: Mapped[Optional[str]] = Column(Text, nullable=True)
    experience_summary: Mapped[Optional[str]] = Column(Text, nullable=True)
    target_skills_json: Mapped[Optional[list]] = Column(JSON, nullable=True)
    ai_summary: Mapped[Optional[str]] = Column(Text, nullable=True)
    score_weights: Mapped[Optional[dict]] = Column(JSON, nullable=True)

    criteria: Mapped[list["Criterion"]] = relationship("Criterion", back_populates="tender")
    bidders: Mapped[list["Bidder"]] = relationship("Bidder", back_populates="tender")
    target_skills: Mapped[list["Skill"]] = relationship(
        "Skill",
        secondary=job_skill_association,
        back_populates="jobs",
    )

class Criterion(Base):
    __tablename__ = "criteria"

    id: Mapped[str] = Column(String, primary_key=True, index=True)
    tender_id: Mapped[str] = Column(String, ForeignKey("tenders.id"))
    category: Mapped[str] = Column(String)
    name: Mapped[str] = Column(String)
    threshold: Mapped[str] = Column(String)
    mandatory: Mapped[bool] = Column(Boolean, default=True)
    source_page: Mapped[int] = Column(Integer)
    source_text: Mapped[str] = Column(Text)

    tender: Mapped["Tender"] = relationship("Tender", back_populates="criteria")

class Bidder(Base):
    __tablename__ = "bidders"

    id: Mapped[str] = Column(String, primary_key=True, index=True)
    tender_id: Mapped[str] = Column(String, ForeignKey("tenders.id"))
    name: Mapped[str] = Column(String)
    status: Mapped[str] = Column(String, default="parsing")
    match_score: Mapped[Optional[float]] = Column(Float, nullable=True)
    hidden_talent_score: Mapped[Optional[float]] = Column(Float, nullable=True)
    future_potential_score: Mapped[Optional[float]] = Column(Float, nullable=True)
    learning_ability_score: Mapped[Optional[float]] = Column(Float, nullable=True)
    authenticity_score: Mapped[Optional[float]] = Column(Float, nullable=True)
    passion_score: Mapped[Optional[float]] = Column(Float, nullable=True)
    team_compatibility: Mapped[Optional[dict]] = Column(JSON, nullable=True)
    is_disqualified: Mapped[bool] = Column(Boolean, default=False)
    disqualification_reason: Mapped[Optional[str]] = Column(String, nullable=True)
    documents: Mapped[Optional[list[str]]] = Column(JSON)
    file_hashes: Mapped[Optional[dict[str, str]]] = Column(JSON)
    checklist_status: Mapped[Optional[dict[str, str]]] = Column(JSON)
    parsed_profile: Mapped[Optional[dict]] = Column(JSON, nullable=True)
    resume_text: Mapped[Optional[str]] = Column(Text, nullable=True)
    skills: Mapped[list["Skill"]] = relationship(
        "Skill",
        secondary=candidate_skill_association,
        back_populates="candidates",
    )

    tender: Mapped["Tender"] = relationship("Tender", back_populates="bidders")
    evaluations: Mapped[list["Evaluation"]] = relationship("Evaluation", back_populates="bidder")
    resumes: Mapped[list["Resume"]] = relationship("Resume", back_populates="candidate")
    analytics: Mapped[list["AIAnalytics"]] = relationship("AIAnalytics", back_populates="candidate")

class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[str] = Column(String, primary_key=True, index=True)
    candidate_id: Mapped[str] = Column(String, ForeignKey("bidders.id"))
    filename: Mapped[str] = Column(String)
    file_path: Mapped[str] = Column(String)
    text_content: Mapped[Optional[str]] = Column(Text, nullable=True)
    parsed_data: Mapped[Optional[dict]] = Column(JSON, nullable=True)
    uploaded_at: Mapped[datetime] = Column(DateTime, default=datetime.utcnow)

    candidate: Mapped["Bidder"] = relationship("Bidder", back_populates="resumes")

class Evaluation(Base):
    __tablename__ = "evaluations"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    bidder_id: Mapped[str] = Column(String, ForeignKey("bidders.id"))
    criterion_id: Mapped[str] = Column(String, ForeignKey("criteria.id"))
    verdict: Mapped[str] = Column(String)
    confidence: Mapped[str] = Column(String)
    match_type: Mapped[str] = Column(String)
    extracted_value: Mapped[str] = Column(String)
    reasoning: Mapped[str] = Column(Text)
    source_page: Mapped[int] = Column(Integer)
    source_document: Mapped[Optional[str]] = Column(String, nullable=True)
    evidence_snippet: Mapped[Optional[str]] = Column(Text, nullable=True)
    action_required: Mapped[Optional[str]] = Column(Text, nullable=True)

    bidder: Mapped["Bidder"] = relationship("Bidder", back_populates="evaluations")

class AIAnalytics(Base):
    __tablename__ = "ai_analytics"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    candidate_id: Mapped[str] = Column(String, ForeignKey("bidders.id"))
    analysis_type: Mapped[str] = Column(String)
    metrics: Mapped[dict] = Column(JSON)
    generated_at: Mapped[datetime] = Column(DateTime, default=datetime.utcnow)

    candidate: Mapped["Bidder"] = relationship("Bidder", back_populates="analytics")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    timestamp: Mapped[datetime] = Column(DateTime, default=datetime.utcnow)
    user: Mapped[str] = Column(String)
    action: Mapped[str] = Column(String)
    entity: Mapped[str] = Column(String)
    details: Mapped[str] = Column(Text)
    type: Mapped[str] = Column(String)
