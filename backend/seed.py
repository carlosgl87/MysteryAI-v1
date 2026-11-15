"""Explicit, repeatable fictional data: python -m backend.seed."""
import json
from datetime import datetime, timezone
from pathlib import Path
from backend.db import Session, Campaign
from backend.schemas import CampaignInput
from backend.simulation import simulate


def seed():
    config = CampaignInput.model_validate(json.loads(Path(__file__).with_name('demo.json').read_text())).model_dump()
    with Session.begin() as s:
        if s.get(Campaign, config['id']):
            return
        c = Campaign(id=config['id'], config=config, status='draft', rubric_version='', created_at=datetime.now(timezone.utc))
        s.add(c)
        s.flush()
        simulate(s, c)


if __name__ == '__main__':
    seed()
