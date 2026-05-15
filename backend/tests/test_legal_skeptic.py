"""Smoke tests for the Legal Skeptic agent.

These hit the real Anthropic API. Skipped if ANTHROPIC_API_KEY isn't set so
CI-without-secrets and local dev without a key don't fail.

Run with: pytest backend/tests/test_legal_skeptic.py -v
"""
import os

import pytest
from dotenv import load_dotenv

from red_room.agents.base import _extract_json_array
from red_room.agents.legal_skeptic import LegalSkeptic
from red_room.schemas import Critique


load_dotenv()
needs_api = pytest.mark.skipif(
    not os.getenv("ANTHROPIC_API_KEY"),
    reason="ANTHROPIC_API_KEY not set",
)


# A draft with a textbook libel risk: criminal verb + single anonymous source
# + thin right-of-reply.
RISKY_DRAFT = (
    "City councilman Mark Reyes stole more than $400,000 from a youth sports "
    "nonprofit he chaired, according to a former board member who spoke on "
    "condition of anonymity. Reyes did not respond to a request for comment."
)

# A draft with attributed, sourced facts and the subject given a chance to respond.
CLEAN_DRAFT = (
    "Senator Linda Hart voted against the housing bill on Tuesday after "
    "receiving more than $200,000 in campaign donations from the real-estate "
    "lobby over the past two years, federal disclosure filings show. Hart's "
    "office said the senator's vote reflected concerns about local zoning "
    "preemption."
)


def test_extract_json_array_basic():
    assert _extract_json_array('prelude [1, 2, 3] trailing') == [1, 2, 3]


def test_extract_json_array_handles_strings_with_brackets():
    text = '[{"q": "hello [world]", "n": 1}]'
    assert _extract_json_array(text) == [{"q": "hello [world]", "n": 1}]


def test_extract_json_array_returns_none_when_absent():
    assert _extract_json_array("no array here, sorry.") is None


@needs_api
async def test_legal_skeptic_flags_libel_risk():
    agent = LegalSkeptic()
    critiques, _ = await agent.critique(RISKY_DRAFT)
    assert critiques, "expected at least one flag on a draft with 'stole' + anon source"
    # Every returned quote must literally appear in the article
    for c in critiques:
        assert isinstance(c, Critique)
        assert c.text_quote in RISKY_DRAFT
        start, end = c.span
        assert RISKY_DRAFT[start:end] == c.text_quote


@needs_api
async def test_legal_skeptic_quiet_on_clean_draft():
    agent = LegalSkeptic()
    critiques, _ = await agent.critique(CLEAN_DRAFT)
    # Allow up to one low-severity flag — clean ≠ "no possible feedback" — but
    # nothing high-severity should fire on a story that's well-attributed.
    high = [c for c in critiques if c.severity == "high"]
    assert not high, f"unexpected high-severity flags on clean draft: {high}"
