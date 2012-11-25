// Aliases for the rather verbose methods on ES5
var descriptor  = Object.getOwnPropertyDescriptor
  , properties  = Object.getOwnPropertyNames
  , define_prop = Object.defineProperty

// (target:Object, source:Object) → Object
// Copies properties from `source' to `target'
function extend(target, source) {
    properties(source).forEach(function(key) {
        define_prop(target, key, descriptor(source, key)) })

    return target;
}

Array.prototype.get = function(property) {
	var res = [];
	for (var i = 0; i < this.length; i ++) {
		res.push(this[i][property]);
	};
	return res;
};

function Term(period, year){
	this.period = period; // Winter, Spring, Summer, Autumn
	this.year = year;
	this.id = period + year;
}

function Schedule(terms, constraint) {
	this.constraint = constraint;
	this.units = {};
	this.courses = {};

	for (var i = terms.length - 1; i >= 0; i--) {
		this.units[terms[i].id] = { "min" : 0, "max" : 0};
		this.courses[terms[i].id] = [];
	};
}

function CourseOffering(id, name, units, term, days, startTime, endTime) {
	this.id = id
	this.name = name
	this.units = units
	this.term = term
	this.days = days
	this.startTime = startTime
	this.endTime = endTime
}

CourseOffering.prototype.fitsIn = function(schedule) {
	return schedule.canAddCourseOffering(this);
};

CourseOffering.prototype.conflictsWith = function(courseOffering) {

	//same term?
	if (courseOffering.term.id !== this.term.id)
		return false;

	//same days?
	if (_.isEmpty(_.intersection(courseOffering.days, this.days)))
		return false;

	//same time?
	if ((this.startTime < courseOffering.startTime || this.startTime >= courseOffering.endTime)
			&& (courseOffering.startTime < this.startTime || courseOffering.startTime >= this.endTime))		
		return false;

	return true;
};

function Course(id, name, desc, units, terms, courseOfferings) {
	this.id = id;
	this.name = name;
	this.desc = desc;
	this.units = units;
	this.terms = terms;
	this.courseOfferings = courseOfferings;
}

Course.prototype.getTerms = function() {
	return this.terms;
};


Course.prototype.canBePicked = function(scheduleList) {
	for (var i = scheduleList.length - 1; i >= 0; i--) {
		var schedule = scheduleList[i];
		for (var j = this.courseOfferings.length - 1; j >= 0; j--) {
			var courseOffering = this.courseOfferings[j];
			if (courseOffering.fitsIn(schedule))
				return true;
		};
	};
	return false;
};


Schedule.prototype.canAddCourseOffering = function(newCourseOffering) {
	var termID = newCourseOffering.term.id

	if (!_.contains(this.getTermIDs(), termID)) {
		console.log("Course offering is for a term that's not chosen")
		return false;
	};
	for (var i = this.courses[termID].length - 1; i >= 0; i--) {
		if(this.courses[termID][i].conflictsWith(newCourseOffering)) {
			console.log("conflict")
			return false;
		};
	};
	console.log("no conflict")


	if(this.constraint && !this.constraint.isSatisfiedBy(this.courses[termID].concat([newCourseOffering]))) {
		console.log("constraint not satisfied");
		return false;
	}

	console.log("no constraints violated")
	return true;
};

Schedule.prototype.add = function(courseOffering) {
	var termID = courseOffering.term.id
	if (!_.contains(this.getTermIDs(), termID)) {
		console.log("Course offering is for a term that's not chosen. Have you called canAddCourseOffering first?")
		return ;
	};
	this.courses[termID].push(courseOffering)
	this.units[termID].min += courseOffering.units.min
	this.units[termID].max += courseOffering.units.max
};

Schedule.prototype.remove = function(courseOffering) {
	var termID = courseOffering.term.id
	if (!_.contains(this.getTermIDs(), termID)) {
		console.log("Course offering is for a term that's not chosen. Case should not happen.")
		return ;
	};
	this.courses[termID] = this.courses[termID].filter (function(offering){
		return offering.id !== courseOffering.id
	})
};

Schedule.prototype.getTermIDs = function() {
	return _.keys(this.courses);
};


Schedule.prototype.fulfills = function(unitRequirement, alreadyTaken) {

	var requiredIds = unitRequirement.courseList.map(function(course){return course.id});

	var maxUnitsPerTerm;
	if (this.constraint) {
		maxUnitsPerTerm = this.constraint.maxUnitsPerTerm;
	};

	var unitsTowardsReq = 0;

	//add in the units for courses already taken
	alreadyTaken.filter(function(c){ return _.contains(requiredIds, c.course.id)})
		.forEach(function(c){unitsTowardsReq += c.units});

	var termIDs = this.getTermIDs();

	for (var i = termIDs.length - 1; i >= 0; i--) {
		var termID = termIDs[i];
		var courseOfferings = this.courses[termID];
		var units = {};
		var unitsLeft = maxUnitsPerTerm || 24;
		for (var i = courseOfferings.length - 1; i >= 0; i--) {
			var courseOffering = courseOfferings[i];
			units[courseOffering] = courseOffering.units.min;
			unitsLeft -= units[courseOffering];
		};
		for (var i = courseOfferings.length - 1; i >= 0; i--) {
			var courseOffering = courseOfferings[i];
			if (_.contains(requiredIds, courseOffering.id)) {
				var addedUnits = Math.min(courseOffering.units.max - courseOffering.units.min, unitsLeft);
				units[courseOffering] += addedUnits;
				unitsTowardsReq += units[courseOffering];
				unitsLeft -= addedUnits;
			};
		};
	};

	return unitsTowardsReq >= unitRequirement.requiredUnitCount;


};

function ScheduleList(courses, terms, constraint){
	this.schedules = [new Schedule(terms, constraint)];
	this.constraint = constraint;
	this.courses = [];
	this.terms = terms;

	if (courses) {
		courses.forEach(function(course){
			this.addCourse(course);
		}, this)
	};
}

ScheduleList.prototype.getScheduleCount = function() {
	return this.schedules.length
};

ScheduleList.prototype.canPick = function(course) {
	return course.canBePicked(this)
};

ScheduleList.prototype.addCourse = function(course) {
	var newSchedules = []
	while (!_.isEmpty(this.schedules)){
		var schedule = this.schedules.pop();
		course.courseOfferings.forEach(function(courseOffering){
			if (schedule.canAddCourseOffering(courseOffering)) {
				var newSchedule = jQuery.extend(true, new Schedule(this.terms, this.constraint), schedule);
				newSchedule.add(courseOffering);
				newSchedules.push(newSchedule);
			};
		}, this);
	}

	this.courses.push(course);

	this.schedules = newSchedules
	console.log(newSchedules.length)
};

ScheduleList.prototype.removeCourse = function(course) {
	this.courses = this.courses.filter(function(course_){
		return course_.id !== course.id;
	})

	this.recalculate();
};

ScheduleList.prototype.setCourses = function(courses) {
	this.courses = courses;
	this.recalculate();
};

ScheduleList.prototype.getCourses = function() {
	return this.courses;
};

ScheduleList.prototype.fulfills = function(requirement) {
	switch (requirement.constructor.name){

		case "CourseRequirement":
			if(_.intersection(this.courses, requirement.courseList).length < requirement.requiredCourseCount)
				return false;
			else
				return this.getScheduleCount() > 0;
			break;

		case "UnitRequirement":
			for (var i = this.schedules.length - 1; i >= 0; i--) {
				var schedule = this.schedules[i];
				if (schedule.fulfills(requirement))
					return true;
			};
			return false;
			break;

		default:
			return true;
			break;
	}
};

ScheduleList.prototype.addTerm = function(term) {
	if (_.contains(this.terms.get('id'), term['id'])) {
		console.log("Term already added");
		return;
	};

	this.terms.push(term);
	this.recalculate();
};

ScheduleList.prototype.removeTerm = function(term) {
	var termIDs = this.terms.get('id');
	var index = termIDs.indexOf(term.id);
	if (index < 0) {
		console.log("Cannot remove term that's not in list");
	}
	else {
		this.terms.splice(index);
		this.recalculate();
	}
};

ScheduleList.prototype.setTerms = function(terms) {
	this.terms = terms;
	this.recalculate();
};

ScheduleList.prototype.getTerms = function() {
	return this.terms;
};

ScheduleList.prototype.recalculate = function(){
	extend(this, new ScheduleList(this.courses, this.terms, this.constraint));
}

ScheduleList.prototype.setConstraint = function(constraint) {
	this.constraint = constraint;
	this.recalculate();
};

ScheduleList.prototype.getConstraint = function() {
	return this.constraint;
};

/*
	Requirement types:
	- Number of courses from a list: Foundations, A, B, sometimes C
	- Number of units: Depth (27) and Breadth (9), 45 total units
*/
function Requirement(name, courseCount, unitCount, courseList){
	this.name = name;
	this.requiredCourseCount = courseCount || 0;
	this.requiredUnitCount = unitCount || 0;
	this.courseList = courseList;
}

function CourseRequirement(name, courseCount, courseList){
	Requirement.call(this, name, courseCount, 0, courseList);
}

function UnitRequirement(name, unitCount, courseList){
	Requirement.call(this, name, 0, unitCount, courseList);
}

CourseRequirement.prototype.adjusted = function(waivedCourses, alreadyTakenCourses) {
	//may want to amke waive/no-waive a type in the requirement
	var allowsWaive = ! this.name.match(/Depth/);

	var courseIDs = this.courseList.get('id');
	var alreadyTakenCourseIDs = alreadyTakenCourses.get('course').get('id');

	var waivedIDs = [];

	if (allowsWaive) {
		waivedIDs = waivedCourses.get('id');
	};

	var alreadyCounted = _.intersection(courseIDs, _.union(alreadyTakenCourseIDs, waivedIDs));

	return new CourseRequirement(this.name, this.requiredCourseCount - alreadyCounted.length, this.courseList);
};

UnitRequirement.prototype.adjusted = function(waivedCourses, alreadyTakenCourses) {
	var courseIDs = this.courseList.get('id');
	var alreadyTakenUnits = 0;
	alreadyTakenCourses.filter(function(c){ return _.contains(courseIDs, c.course.id)})
					.forEach(function(c){ alreadyTakenUnits += c.units});

	return new UnitRequirement(this.name, this.requiredUnitCount - alreadyTakenUnits, this.courseList);
};


function Constraint(maxUnitsPerTerm, maxDaysPerTerm){
	this.maxUnitsPerTerm = maxUnitsPerTerm || 18;
	this.maxDaysPerTerm = maxDaysPerTerm || 5;
}

Constraint.prototype.isSatisfiedBy = function(courseOfferings) {
	var result = true;

	if (this.maxUnitsPerTerm > 0) {
		var minSum = 0
		for (var i = courseOfferings.length - 1; i >= 0; i--) {
			minSum += courseOfferings[i].units.min;
		};
		console.log(minSum)
		result = result && (minSum <= this.maxUnitsPerTerm);
	};

	if (this.maxDaysPerTerm < 5) {
		var unionDays = [];
		for (var i = courseOfferings.length - 1; i >= 0; i--) {
			unionDays = _.union(unionDays, courseOfferings[i].days);
		};
		result = result && (unionDays.length <= maxDaysPerTerm);
	};
	return result;
};

function Program(name, breadthCourses, depthCourses, singleDepthReqs, primaryDepthReqs, secondaryDepthReqs){
	this.name = name;
	this.breadthCourses = breadthCourses;
	this.depthCourses = depthCourses;
	this.singleDepthReqs = singleDepthReqs;
	this.primaryDepthReqs = primaryDepthReqs;
	this.secondaryDepthReqs = secondaryDepthReqs;
}

function Application(){
	this.loaded = false;

	//private static data
	this.allCourses = [];
	this.programs = [];
	this.foundationsRequirement = undefined;
	this.significantImplementationRequirement = undefined;
	this.totalUnitRequirement = undefined;

	//data user can change
	this.specialization = {};
	this.waivedCourses = [];
	this.alreadyTakenCourses = [];

	//private variable data
	this.scheduleList = new ScheduleList([], [], undefined);
	this.activeRequirements = [];
	
};

Application.prototype.init = function(callback) {
	console.log("Loading");

	this.initCourses(function(){
		this.initPrograms(function(){
			this.initScheduleList(function(){
				console.log("Done Loading");
				this.loaded = true;
				this.start();
			});
		});
	});
};

Application.prototype.initCourses = function(callback) {

	var app = this;
	$.getJSON('allcourses.json', function (courseList){
		app.allCourses = courseList.map(function(c){
			var id = c.id;
			var name = c.name;
			var desc = c.desc;
			var units = {
				min: c.units.min,
				max: c.units.max
			};
			var courseOfferings = c.courseOfferings.map(function(off){
				return new CourseOffering(id, 
					name, 
					units, 
					new Term(off.term.period, off.term.year),
					off.days, 
					off.start, 
					off.end);
			});
			var terms = courseOfferings.map(function(off){
				return off.term;
			})
			return new Course( id,
				name,
				desc,
				units,
				terms,
				courseOfferings);
		})
		if(callback)
			callback.call(app);
	});	
};

Application.prototype.initPrograms = function(callback) {
	var app = this;

	var findCourseByID = function(courseList, id){
		return courseList.filter(function(c){
				return c.id === id;
			})[0];
	};

	var parseReq = function(req){
		var courses = req.courses.map(function(id){
			return findCourseByID(app.allCourses, id);
		});
		switch (req.type){
			case "CourseRequirement":
				return new CourseRequirement(req.name, req.required, courses);
				break;
			case "UnitRequirement":
				return new UnitRequirement(req.name, req.required, courses);
				break;
			default:
				console.log("Error: unknown requirement type");
				break;
		}
	};


	if (!this.allCourses) {
		console.log("Error: Must load courses first");
		return;
	};

	var foundationIDs = ['CS 103', 'CS 107', 'CS 109', 'CS 110', 'CS 161'];
	var foundationCourses = foundationIDs.map(function(id){
		return findCourseByID(app.allCourses, id);
	});

	var significantImplementationIDs = ['CS 140', 'CS 143', 'CS 144', 'CS 145', 'CS 148', 'CS 210B', 'CS 221', 'CS 243', 'CS 248'];
	var significantImplementationCourses = significantImplementationIDs.map(function(id){
		return findCourseByID(app.allCourses, id);
	});

	app.totalUnitRequirement = new UnitRequirement("45 Total Units", 45, this.allCourses);

	app.foundationsRequirement = new CourseRequirement("Foundations", 5, foundationCourses);
	app.significantImplementationRequirement = new CourseRequirement("Significant Implementation", 1, significantImplementationCourses);

	app.activeRequirements = [app.totalUnitRequirement, app.foundationsRequirement, app.significantImplementationRequirement];

	$.getJSON('allprograms.json', function(programList){
		app.programs = programList.map(function(p){
			var breadthCourses = p.breadthCourses.map(function(id){
				return findCourseByID(app.allCourses, id);
			});
			var depthCourses = p.depthCourses.map(function(id){
				return findCourseByID(app.allCourses, id);
			});
			var singleDepthReqs = p.requirements.singleDepth.map(function(req){
				return parseReq(req);
			});
			var primaryDepthReqs = p.requirements.primaryDepth.map(function(req){
				return parseReq(req);
			});
			var secondaryDepthReqs = p.requirements.secondaryDepth.map(function(req){
				return parseReq(req);
			})


			return new Program(p.name,
				breadthCourses,
				depthCourses, 
				singleDepthReqs,
				primaryDepthReqs, 
				secondaryDepthReqs);
		});

		if(callback)
			callback.call(app);
	});
};

Application.prototype.start = function() {
	//TODO start application
	if (!this.loaded) {
		console.log("Error: data not loaded");
	};
	console.log("Application starting!");
};


Application.prototype.initScheduleList = function (callback){
	this.scheduleList = new ScheduleList([], [], undefined);
	if (callback) {
		callback.call(this);
	};
}

Application.prototype.getPrograms = function() {
	return this.programs;
};

// All terms methods are delegated to the ScheduleList
Application.prototype.setTerms = function(terms) {
	this.scheduleList.setTerms(terms);
};

Application.prototype.addTerm = function(term) {
	this.scheduleList.addTerm(term);
};

Application.prototype.removeTerm = function(term) {
	this.scheduleList.removeTerm(term);
};

Application.prototype.getTerms = function(){
	return this.scheduleList.getTerms();
}

Application.prototype.getConstraint = function() {
	return this.scheduleList.getConstraint();
};

Application.prototype.setConstraint = function(constraint) {
	this.scheduleList.setConstraint(constraint);
};

Application.prototype.setSpecialization = function(specialization) {
	this.specialization = specialization;
	this.activeRequirements = new Array(this.foundationsRequirement,
		this.significantImplementationRequirement,
		this.totalUnitRequirement).concat(this.specialization.getRequirements());
};

Application.prototype.getSpecialization = function() {
	return this.specialization;
};

Application.prototype.getRequirements = function() {
	return this.activeRequirements;
};

Application.prototype.addCourse = function(course) {
	this.scheduleList.addCourse(course);
};

Application.prototype.addCourseByID = function(id) {
	var course = _.find(this.allCourses, function(c){return c.id === id});
	if (course) {
		this.scheduleList.addCourse(course);
	}
	else {
		console.log("Course not found: " + id);
	}
};

Application.prototype.removeCourse = function(course) {
	this.scheduleList.removeCourse(course);
};

Application.prototype.getCourses = function() {
	this.scheduleList.getCourses();
};

Application.prototype.setCourses = function(courses) {
	this.scheduleList.setCourses();
};

Application.prototype.canPick = function(course) {
	return this.scheduleList.canPick(course);
};

Application.prototype.setWaivedCourses = function(courses) {
	this.waivedCourses = courses;
};

Application.prototype.getWaivedCourses = function() {
	return this.waivedCourses;
};

Application.prototype.addWaivedCourse = function(course) {
	if(_.contains(this.waivedCourses, course)){
		console.log("Error: course already waived");
	}
	else{
		this.waivedCourses.push(course);
	}
};

Application.prototype.addWaivedCourseByID = function(id) {
	var course = _.find(this.allCourses, function(c){return c.id === id});
	if (course) {
		this.addWaivedCourse(course);
	}
	else {
		console.log("Course not found: " + id);
	}
};

//already taken courses in the format {course: <Course>, units: <taken Units> }
Application.prototype.setAlreadyTakenCourses = function(courses) {
	this.alreadyTakenCourses = courses;
};

Application.prototype.getAlreadyTakenCourses = function() {
	return this.alreadyTakenCourses;
};

Application.prototype.addAlreadyTakenCourse = function(course, units) {
	if(_.contains(this.alreadyTakenCourses.get('course'), course)){
		console.log("Error: course already marked as taken");
	}
	else{
		this.alreadyTakenCourses.push({course: course, units: units});
	}
};

Application.prototype.addAlreadyTakenCourseByID = function(id, units) {
	var course = _.find(this.allCourses, function(c){return c.id === id});
	if (course) {
		this.addAlreadyTakenCourse(course, units);
	}
	else {
		console.log("Course not found: " + id);
	}
};

Application.prototype.fulfills = function(requirement) {
	var adjustedRequirement = requirement.adjusted(this.waivedCourses, this.alreadyTakenCourses);
	return this.scheduleList.fulfills(adjustedRequirement);
};



function SingleDepthSpecialization(program) {
	this.singleDepth = program;
}

SingleDepthSpecialization.prototype.getRequirements = function() {
	return this.singleDepth.singleDepthReqs;
};

SingleDepthSpecialization.prototype.getFulfilledRequirements = function(scheduleList) {
	return this.getRequirements().filter(function(req){
		return scheduleList.fulfills(req);
	});
};

function DualDepthSpecialization(primary, secondary){
	this.primaryDepth = primary;
	this.secondaryDepth = secondary;
}

DualDepthSpecialization.prototype.getRequirements = function() {
	return this.primaryDepth.primaryDepthReqs.concat(this.secondaryDepth.secondaryDepthReqs);
};

DualDepthSpecialization.prototype.getFulfilledRequirements = function(scheduleList) {
	return this.getRequirements().filter(function(req){
		return scheduleList.fulfills(req);
	});
};

Application.prototype.getSchedules = function() {
	return this.scheduleList.schedules;
};

Application.prototype.getSchedulesMeetingReqs = function() {
	return this.scheduleList.schedules.filter(function(schedule){
		return this.activeRequirements.every(function(req){schedule.fulfills(req)});
	});
};


//TODO:
//overlapping requirements
//at most ten units from foundations
//tests

var foundations = {
	"required" : 5,
	"courses" : [
		{
				"id" : "CS103",
				"name" : "Mathematical Foundations of Computing",
				"units" : {"min": 3, "max": 5},
				"terms" : {
					"Autumn" : {
						"days" : ["Mon", "Wed", "Fri"],
						"start" : 1415,
						"end" : 1530
					},
					"Winter" : {
						"days" : ["Mon", "Wed", "Fri"],
						"start" : 1250,
						"end" : 1405
					},
					"Spring" : {
						"days" : ["Mon", "Wed", "Fri"],
						"start" : 1250,
						"end" : 1405
					}
				}
			},
			{
				"id" : "CS107",
				"name" : "Computer Organization and Systems",
				"units" : {"min": 3, "max": 5},
				"terms" : {
					"Autumn" : {
						"days" : ["Mon", "Fri"],
						"start" : 1100,
						"end" : 1215
					},
					"Winter" : {
						"days" : ["Mon", "Wed", "Fri"],
						"start" : 1000,
						"end" : 1050
					},
					"Spring" : {
						"days" : ["Mon", "Fri"],
						"start" : 1100,
						"end" : 1215
					}
				}
			},
			{
				"id" : "CS109",
				"name" : "Introduction to Probability for Computer Scientists",
				"units" : {"min": 3, "max": 5},
				"terms" : {
					"Winter" : {
						"days" : ["Mon", "Wed", "Fri"],
						"start" : 1250,
						"end" : 1415
					},
					"Spring" : {
						"days" : ["Mon", "Wed", "Fri"],
						"start" : 1250,
						"end" : 1415
					}
				}
			},
			{
				"id" : "CS110",
				"name" : "Principles of Computer Systems",
				"units" : {"min": 3, "max": 5},
				"terms" : {
					"Autumn" : {
						"days" : ["Mon", "Wed", "Fri"],
						"start" : 1100,
						"end" : 1150
					},
					"Winter" : {
						"days" : ["Mon", "Wed", "Fri"],
						"start" : 1100,
						"end" : 1150
					},
					"Spring" : {
						"days" : ["Mon", "Wed", "Fri"],
						"start" : 1000,
						"end" : 1050
					}
				}
			},
			{
				"id" : "CS161",
				"name" : "Design and Analysis of Algorithms",
				"units" : {"min": 3, "max": 5},
				"terms" : {
					"Autumn" : {
						"days" : ["Tue", "Thu"],
						"start" : 1100,
						"end" : 1215
					},
					"Spring" : {
						"days" : ["Mon", "Wed"],
						"start" : 1615,
						"end" : 1730
					}
				}
			}
	]
}

var computer_sec_reqs = {
	"A": {
		"required" : 5,
		"courses" : [
			{
				"id" : "CS140",
				"name" : "Operating Systems and Systems Programming",
				"units" : {"min": 3, "max": 4},
				"terms" : {
					"Autumn" : {
						"days" : ["Mon", "Wed"],
						"start" : 1415,
						"end" : 1530
					},
					"Winter" : {
						"days" : ["Mon", "Wed", "Fri"],
						"start" : 1000,
						"end" : 1050
					}
				}
			},
			{
				"id" : "CS144",
				"name" : "Introduction to Computer Networking",
				"units" : {"min": 3, "max": 4},
				"terms" : {
					"Autumn" : {
						"days" : ["Tue", "Thu"],
						"start" : 1615,
						"end" : 1730
					}
				}
			},
			{
				"id" : "CS155",
				"name" : "Computer and Network Security",
				"units" : {"min": 3, "max": 3},
				"terms" : {
					"Spring" : {
						"days" : ["Tue", "Thu"],
						"start" : 1415,
						"end" : 1530
					}
				}
			},
			{
				"id" : "CS244",
				"name" : "Advanced Topics in Networking",
				"units" : {"min": 3, "max": 4},
				"terms" : {
					"Winter" : {
						"days" : ["Mon", "Wed"],
						"start" : 1415,
						"end" : 1530
					}
				}
			},
			{
				"id" : "CS255",
				"name" : "Introduction to Cryptography",
				"units" : {"min": 3, "max": 3},
				"terms" : {
					"Winter" : {
						"days" : ["Mon", "Wed"],
						"start" : 1415,
						"end" : 1530
					}
				}
			}
		]		
	},

	"B" : {
		"required" : 3,
		"courses" : [
			{
				"id" : "CS142",
				"name" : "Web Applications",
				"units" : {"min": 3, "max": 3},
				"terms" : {
					"Spring" : {
						"days" : ["Mon", "Wed", "Fri"],
						"start" : 1100,
						"end" : 1150
					}
				}
			},
			{
				"id" : "CS240",
				"name" : "Advanced Topics in Operating Systems",
				"units" : {"min": 3, "max": 3},
				"terms" : {
					"Winter" : {
						"days" : ["Mon", "Wed"],
						"start" : 1615,
						"end" : 1730
					},
					"Spring" : {
						"days" : ["Tue", "Thu"],
						"start" : 1615,
						"end" : 1730
					}
				}
			},
			{
				"id" : "CS241",
				"name" : "Secure Web Programming",
				"units" : {"min": 3, "max": 3},
				"terms" : {}
			},
			{
				"id" : "CS244B",
				"name" : "Distributed Systems",
				"units" : {"min": 3, "max": 3},
				"terms" : {
					"Spring" : {
						"days" : ["Tue", "Thu"],
						"start" : 1100,
						"end" : 1215
					}
				}
			},
			{
				"id" : "CS244C",
				"name" : "Readings and Projects in Distributed Systems",
				"units" : {"min": 3, "max": 6},
				"terms" : {}
			},
			{
				"id" : "CS259",
				"name" : "Security Analysis of Network Protocols",
				"units" : {"min": 3, "max": 3},
				"terms" : {
					"Winter" : {
						"days" : ["Mon", "Wed"],
						"start" : 1250,
						"end" : 1405
					}
				}
			},
			{
				"id" : "CS261",
				"name" : "Optimization and Algorithmic Paradigms",
				"units" : {"min": 3, "max": 3},
				"terms" : {
					"Winter" : {
						"days" : ["Tue", "Thu"],
						"start" : 1415,
						"end" : 1530
					}
				}
			},
			{
				"id" : "CS344",
				"name" : "Topics in Computer Networks",
				"units" : {"min": 3, "max": 3},
				"terms" : {}
			},
			{
				"id" : "CS355",
				"name" : "Advanced Topics in Cryptography",
				"units" : {"min": 3, "max": 3},
				"terms" : {}
			},
			{
				"id" : "CS365",
				"name" : "Randomized Algorithms",
				"units" : {"min": 3, "max": 3},
				"terms" : {
					"Winter" : {
						"days" : ["Tue", "Thu"],
						"start" : 1100,
						"end" : 1215
					}
				}
			}
		]
	},

	"C": {
		"required": 0,
		"courses" : [
			{
				"id" : "CS244E",
				"name" : "Networked Wireless Systems",
				"units" : {"min": 3, "max": 3},
				"terms" : {}
			},
			{
				"id" : "CS245",
				"name" : "Database Systems Principles",
				"units" : {"min": 3, "max": 3},
				"terms" : {
					"Winter" : {
						"days" : ["Tue", "Thu"],
						"start" : 1250,
						"end" : 1405
					}
				}
			},
			{
				"id" : "CS294S",
				"name" : "Research Project in Software Systems and Security",
				"units" : {"min": 3, "max": 3},
				"terms" : {
					"Spring" : {
						"days" : ["Mon", "Wed"],
						"start" : 1100,
						"end" : 1215
					}
				}
			},
			{
				"id" : "CS295",
				"name" : "Software Engineering",
				"units" : {"min": 2, "max": 3},
				"terms" : {}
			},
			{
				"id" : "CS341",
				"name" : "Project in Mining Massive Data Sets",
				"units" : {"min": 3, "max": 3},
				"terms" : {
					"Spring" : {
						"days" : ["Tue", "Thu"],
						"start" : 1615,
						"end" : 1730
					}
				}
			},
			{
				"id" : "CS344B",
				"name" : "Advanced Topics in Distributed Systems",
				"units" : [2],
				"terms" : {}
			},
			{
				"id" : "CS345",
				"name" : "Advanced Topics in Database Systems",
				"units" : {"min": 3, "max": 3},
				"terms" : {}
			},
			{
				"id" : "CS347",
				"name" : "Parallel and Distributed Data Management",
				"units" : {"min": 3, "max": 3},
				"terms" : {
					"Spring" : {
						"days" : ["Mon", "Wed"],
						"start" : 1250,
						"end" : 1405
					}
				}
			},
			{
				"id" : "CS361A",
				"name" : "Advanced Algorithms",
				"units" : {"min": 3, "max": 3},
				"terms" : {}
			},
			{
				"id" : "EE384A",
				"name" : "Internet Routing Protocols and Standards",
				"units" : {"min": 3, "max": 3},
				"terms" : {
					"Winter" : {
						"days" : ["Tue", "Thu"],
						"start" : 930,
						"end" : 1045
					}
				}
			},
			{
				"id" : "EE384C",
				"name" : "Wireless Local and Wide Area Networks",
				"units" : {"min": 3, "max": 3},
				"terms" : {
					"Spring" : {
						"days" : ["Tue", "Thu"],
						"start" : 930,
						"end" : 1045
					}
				}
			},
			{
				"id" : "EE384M",
				"name" : "Network Science",
				"units" : {"min": 3, "max": 3},
				"terms" : {}
			},
			{
				"id" : "EE384S",
				"name" : "Performance Engineering of Computer Systems & Networks",
				"units" : {"min": 3, "max": 3},
				"terms" : {
					"Spring" : {
						"days" : ["Mon", "Wed"],
						"start" : 1100,
						"end" : 1215
					}
				}
			},
			{
				"id" : "EE384X",
				"name" : "Packet Switch Architectures",
				"units" : {"min": 3, "max": 3},
				"terms" : {}
			}
		]
	}
}

var terms = [ new Term('Autumn', '2012-2013'), new Term('Winter', '2012-2013'), new Term('Spring', '2012-2013'),
			  new Term('Autumn', '2013-2014'), new Term('Winter', '2013-2014'), new Term('Spring', '2013-2014')]

// var ACourses = computer_sec_reqs['A'].courses.map(function(course){
// 	return new Course(course, terms);
// })

// var BCourses = computer_sec_reqs['B'].courses.map(function(course){
// 	return new Course(course, terms);
// })

// var CCourses = computer_sec_reqs['C'].courses.map(function(course){
// 	return new Course(course, terms);
// })

// var computer_sec_courses = ACourses.concat(BCourses).concat(CCourses);
// var winterCourses = computer_sec_courses.filter(function(course){
// 	var terms = _.uniq(course.getTerms().get('period'));
// 	return terms.length === 1 && terms[0] === 'Winter';
// })

var app = new Application();
app.init();

app.setTerms(terms);

var constraint = new Constraint(10);
app.setConstraint(constraint);
// var scheduleList = new ScheduleList(undefined, terms.slice(0,5), undefined);
// scheduleList.constraint = constraint;

// var context = {}
// context.constraint = constraint;
// context.terms = terms.slice(0,5);

// init(context);
// var foundationCourses = foundations.courses.map(function(course){
// 	return new Course(course, terms);
// })

// var foundationsReq = new CourseRequirement("Foundations", 5, foundationCourses);
// var AReq = new CourseRequirement("A", computer_sec_reqs['A'].required, ACourses);
// var BReq = new CourseRequirement("B", computer_sec_reqs['B'].required, BCourses);
// var depthReq = new UnitRequirement("Depth", 27, computer_sec_courses);

// console.log(myCourse.canBePicked(scheduleList))
// scheduleList.add(myCourse)
// console.log(scheduleList)

// scheduleList.add(computer_sec_courses[0])
// scheduleList.add(computer_sec_courses[1])
// scheduleList.add(computer_sec_courses[2])
// scheduleList.add(computer_sec_courses[3])
// scheduleList.add(computer_sec_courses[4])



