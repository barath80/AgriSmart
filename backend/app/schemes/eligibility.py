"""Deterministic scheme eligibility. Pure functions — no I/O, fully unit-tested.

Each rule evaluates to PASS, FAIL or UNKNOWN (the farmer's profile lacks the fact).
A scheme is `eligible` only if every rule passes, `not_eligible` if any rule fails,
otherwise `maybe` — and the response lists exactly which facts are missing.
"""

from collections.abc import Callable
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class RuleOutcome(StrEnum):
    PASS = "pass"
    FAIL = "fail"
    UNKNOWN = "unknown"


class Eligibility(StrEnum):
    ELIGIBLE = "eligible"
    MAYBE = "maybe"
    NOT_ELIGIBLE = "not_eligible"


@dataclass(frozen=True, slots=True)
class FarmerFacts:
    state: str | None = None
    district: str | None = None
    land_acres: float | None = None
    age: int | None = None
    crops: frozenset[str] = frozenset()
    irrigated: bool | None = None


@dataclass(slots=True)
class RuleResult:
    rule_type: str
    outcome: RuleOutcome
    missing_fact: str | None = None


@dataclass(slots=True)
class Evaluation:
    status: Eligibility
    results: list[RuleResult] = field(default_factory=list)

    @property
    def missing_facts(self) -> list[str]:
        return sorted({r.missing_fact for r in self.results if r.missing_fact})


def _compare(
    fact: float | None, fact_name: str, check: Callable[[float], bool]
) -> tuple[RuleOutcome, str | None]:
    if fact is None:
        return RuleOutcome.UNKNOWN, fact_name
    return (RuleOutcome.PASS if check(fact) else RuleOutcome.FAIL), None


def _evaluate_rule(rule_type: str, value: Any, facts: FarmerFacts) -> RuleResult:
    match rule_type:
        case "max_land_acres":
            outcome, missing = _compare(facts.land_acres, "land_acres", lambda x: x <= float(value))
        case "min_land_acres":
            outcome, missing = _compare(facts.land_acres, "land_acres", lambda x: x >= float(value))
        case "min_age":
            outcome, missing = _compare(facts.age, "age", lambda x: x >= int(value))
        case "max_age":
            outcome, missing = _compare(facts.age, "age", lambda x: x <= int(value))
        case "states_any":
            if facts.state is None:
                outcome, missing = RuleOutcome.UNKNOWN, "state"
            else:
                allowed = {s.casefold() for s in value}
                outcome, missing = (
                    (RuleOutcome.PASS if facts.state.casefold() in allowed else RuleOutcome.FAIL),
                    None,
                )
        case "crops_any":
            if not facts.crops:
                outcome, missing = RuleOutcome.UNKNOWN, "crops"
            else:
                outcome, missing = (
                    (RuleOutcome.PASS if facts.crops & set(value) else RuleOutcome.FAIL),
                    None,
                )
        case "requires_irrigation":
            if facts.irrigated is None:
                outcome, missing = RuleOutcome.UNKNOWN, "irrigation"
            else:
                outcome, missing = (
                    (RuleOutcome.PASS if facts.irrigated == bool(value) else RuleOutcome.FAIL),
                    None,
                )
        case _:
            # Unknown rule types never silently pass.
            outcome, missing = RuleOutcome.UNKNOWN, f"rule:{rule_type}"
    return RuleResult(rule_type=rule_type, outcome=outcome, missing_fact=missing)


SUPPORTED_RULES = {
    "max_land_acres",
    "min_land_acres",
    "min_age",
    "max_age",
    "states_any",
    "crops_any",
    "requires_irrigation",
}


def evaluate(rules: list[tuple[str, Any]], facts: FarmerFacts) -> Evaluation:
    results = [_evaluate_rule(rule_type, value, facts) for rule_type, value in rules]
    if any(r.outcome is RuleOutcome.FAIL for r in results):
        status = Eligibility.NOT_ELIGIBLE
    elif all(r.outcome is RuleOutcome.PASS for r in results):
        status = Eligibility.ELIGIBLE
    else:
        status = Eligibility.MAYBE
    return Evaluation(status=status, results=results)
