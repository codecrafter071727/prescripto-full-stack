const PRIORITY_RANGE = {
    urgency: { min: 0, max: 10 },
    waitingTime: { min: 0, max: 30 },
    severity: { min: 0, max: 10 }
}

const linguisticLevels = {
    urgency: {
        low: 2,
        medium: 5,
        moderate: 5,
        high: 8.5
    },
    waitingTime: {
        short: 3,
        medium: 10,
        moderate: 10,
        long: 21
    },
    severity: {
        low: 2,
        medium: 5,
        moderate: 5,
        high: 8.5
    },
    riskLevel: {
        low: 2,
        medium: 5,
        moderate: 5,
        high: 8.5
    }
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const toNumber = (value) => {
    const parsedValue = Number(value)
    return Number.isFinite(parsedValue) ? parsedValue : 0
}

const resolveInputValue = (value, variableName) => {
    if (typeof value === "string") {
        const normalizedValue = value.trim().toLowerCase()
        const mappedValue = linguisticLevels[variableName]?.[normalizedValue]

        if (mappedValue !== undefined) {
            return mappedValue
        }
    }

    const numericValue = toNumber(value)
    return clamp(
        numericValue,
        PRIORITY_RANGE[variableName].min,
        PRIORITY_RANGE[variableName].max
    )
}

const triangle = (value, left, peak, right) => {
    if (value <= left || value >= right) {
        return 0
    }

    if (value === peak) {
        return 1
    }

    if (value < peak) {
        return (value - left) / (peak - left)
    }

    return (right - value) / (right - peak)
}

const trapezoid = (value, leftStart, leftTop, rightTop, rightEnd) => {
    if (value <= leftStart || value >= rightEnd) {
        return 0
    }

    if (value >= leftTop && value <= rightTop) {
        return 1
    }

    if (value < leftTop) {
        return (value - leftStart) / (leftTop - leftStart)
    }

    return (rightEnd - value) / (rightEnd - rightTop)
}

const buildMemberships = ({ urgency, waitingTime, severity }) => ({
    urgency: {
        low: trapezoid(urgency, -1, 0, 3, 5),
        medium: triangle(urgency, 3, 5, 7),
        high: trapezoid(urgency, 5, 7, 10, 11)
    },
    waitingTime: {
        short: trapezoid(waitingTime, -1, 0, 4, 8),
        moderate: triangle(waitingTime, 5, 10, 16),
        long: trapezoid(waitingTime, 12, 18, 30, 31)
    },
    severity: {
        low: trapezoid(severity, -1, 0, 3, 5),
        medium: triangle(severity, 3, 5, 7),
        high: trapezoid(severity, 5, 7, 10, 11)
    }
})

const buildRules = (memberships) => [
    { strength: Math.max(memberships.urgency.high, memberships.severity.high), score: 95 },
    { strength: Math.min(memberships.urgency.high, memberships.waitingTime.long), score: 92 },
    { strength: Math.min(memberships.severity.high, memberships.waitingTime.long), score: 94 },
    { strength: Math.min(memberships.urgency.medium, memberships.severity.high), score: 82 },
    { strength: Math.min(memberships.urgency.high, memberships.severity.medium), score: 80 },
    { strength: Math.min(memberships.urgency.medium, memberships.waitingTime.long), score: 76 },
    { strength: Math.min(memberships.severity.medium, memberships.waitingTime.moderate), score: 68 },
    { strength: Math.min(memberships.urgency.medium, memberships.severity.medium), score: 60 },
    { strength: Math.min(memberships.waitingTime.long, memberships.urgency.low), score: 55 },
    {
        strength: Math.min(
            memberships.waitingTime.short,
            memberships.urgency.low,
            memberships.severity.low
        ),
        score: 20
    },
    { strength: Math.min(memberships.urgency.low, memberships.severity.low), score: 28 },
    {
        strength: Math.min(
            memberships.waitingTime.moderate,
            memberships.urgency.low,
            memberships.severity.medium
        ),
        score: 48
    }
]

const getFallbackScore = ({ urgency, waitingTime, severity }) => {
    const urgencyWeight = (urgency / PRIORITY_RANGE.urgency.max) * 35
    const waitingWeight = (waitingTime / PRIORITY_RANGE.waitingTime.max) * 25
    const severityWeight = (severity / PRIORITY_RANGE.severity.max) * 40

    return urgencyWeight + waitingWeight + severityWeight
}

const resolveRiskLevel = (riskLevel) => {
    if (typeof riskLevel === "string") {
        const normalizedValue = riskLevel.trim().toLowerCase()
        if (linguisticLevels.riskLevel[normalizedValue] !== undefined) {
            return normalizedValue
        }
    }

    return "low"
}

const isHighRiskPriority = (pregnancy, riskLevel, severity) => (
    Boolean(pregnancy) && resolveRiskLevel(riskLevel) === "high" && severity >= 7
)

const calculatePriority = (urgencyInput, waitingTimeInput, severityInput, pregnancy = false, riskLevel = "low") => {
    const normalizedInputs = {
        urgency: resolveInputValue(urgencyInput, "urgency"),
        waitingTime: resolveInputValue(waitingTimeInput, "waitingTime"),
        severity: resolveInputValue(severityInput, "severity")
    }

    const memberships = buildMemberships(normalizedInputs)
    const rules = buildRules(memberships)

    const { weightedSum, totalStrength } = rules.reduce(
        (accumulator, rule) => {
            if (rule.strength <= 0) {
                return accumulator
            }

            accumulator.weightedSum += rule.strength * rule.score
            accumulator.totalStrength += rule.strength
            return accumulator
        },
        { weightedSum: 0, totalStrength: 0 }
    )

    const crispScore = totalStrength > 0
        ? weightedSum / totalStrength
        : getFallbackScore(normalizedInputs)

    const pregnancyBoost = isHighRiskPriority(pregnancy, riskLevel, normalizedInputs.severity) ? 12 : 0

    return Math.round(clamp(crispScore + pregnancyBoost, 0, 100))
}

export { calculatePriority, isHighRiskPriority }

export default {
    calculatePriority,
    isHighRiskPriority
}
