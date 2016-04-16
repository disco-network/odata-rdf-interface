var exports = module.exports = {}

var HowMany = exports.HowMany = {
	ONE_TO_ONE: 0,
	ONE_TO_MANY: 1,
};

var Metadata = exports.Metadata = {
	entitySets: {
		Posts: {
			navigationProperties: {
				Content: { EntitySet: "Content", IdProperty: "ContentId", HowMany: HowMany.ONE_TO_ONE },
				RefersTo: { EntitySet: "PostReferences", ReverseProperty: "ReferrerId", HowMany: HowMany.ONE_TO_MANY },
				ReferredFrom: { EntitySet: "PostReferences", ReverseProperty: "ReferreeId", HowMany: HowMany.ONE_TO_MANY },
			},
			properties: {},
		},
		PostReferences: {
			navigationProperties: {
				Referrer: { EntitySet: "Posts", IdProperty: "ReferrerId", HowMany: HowMany.ONE_TO_ONE },
				Referree: { EntitySet: "Posts", IdProperty: "ReferrerId", HowMany: HowMany.ONE_TO_ONE },
			},
			properties: {
				ReferrerId: { Type: "number", NavigationProperty: "Referrer" },
				ReferreeId: { Type: "number", NavigationProperty: "Referree" },
			},
		},
		Content: {
			navigationProperties: {},
			properties: {},
		},
	},
};