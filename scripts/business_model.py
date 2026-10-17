"""Reproduce the report's assumptions. No external dependencies."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def calculate(c):
    events = c['merchants'] * c['events_per_month'] * 12
    attendance = events * c['attendees']
    revenue = attendance * c['fee']
    variable = events * c['labor_per_event'] + attendance * c['other_per_attendee']
    acquisition = c['merchants'] * c['merchant_cac'] / c['merchant_cac_years'] + c['new_paid_users'] * c['user_cac']
    contribution = revenue - variable - c['fixed']
    unit = c['attendees'] * (c['fee'] - c['other_per_attendee']) - c['labor_per_event']
    return dict(events=events, attendance=attendance, revenue=revenue, variable=variable,
                acquisition=acquisition, before_acquisition=contribution, operating=contribution-acquisition,
                per_event=unit, break_even_events=(c['fixed']+acquisition)/unit if unit > 0 else None)

def personal(c):
    paid = c['active'] * c['paid_share']
    return paid*c['monthly_price'] - paid*c['paid_cost'] - (c['active']-paid)*c['free_cost']

def results():
    d = json.loads((ROOT/'docs/business/model-inputs.json').read_text())
    return {'cases':[dict(name=c['name'], **calculate(c)) for c in d['cases']],
            'personal_monthly_contribution':personal(d['personal']),
            'serviceable_people':[d['demand']['london_population']*a*b for a,b in zip(d['demand']['annual_demand_share'],d['demand']['serviceable_share'])]}

if __name__ == '__main__':
    print(json.dumps(results(), ensure_ascii=False, indent=2))
