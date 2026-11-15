"""Campaigns, immutable trial snapshots and deduplicated events."""
from alembic import op
import sqlalchemy as sa
revision = '001'
down_revision = None


def upgrade():
    op.create_table('campaigns', sa.Column('id', sa.String(80), primary_key=True),
                    sa.Column('config', sa.JSON(), nullable=False), sa.Column('status', sa.String(20), nullable=False),
                    sa.Column('rubric_version', sa.String(64), nullable=False),
                    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
    op.create_table('trials', sa.Column('id', sa.String(360), primary_key=True),
                    sa.Column('campaign_id', sa.String(80), sa.ForeignKey('campaigns.id'), nullable=False),
                    sa.Column('data', sa.JSON(), nullable=False))
    op.create_index('ix_trials_campaign_id', 'trials', ['campaign_id'])
    op.create_table('events', sa.Column('id', sa.String(480), primary_key=True),
                    sa.Column('trial_id', sa.String(360), sa.ForeignKey('trials.id'), nullable=False),
                    sa.Column('provider_id', sa.String(120), nullable=False), sa.Column('payload', sa.JSON(), nullable=False),
                    sa.UniqueConstraint('trial_id', 'provider_id'))
    op.create_index('ix_events_trial_id', 'events', ['trial_id'])


def downgrade():
    op.drop_table('events')
    op.drop_table('trials')
    op.drop_table('campaigns')
