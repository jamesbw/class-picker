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

	this.pick = false;
	this.alreadyTaken = false;
	this.waived = false;
}

Course.prototype.getTerms = function() {
	return this.terms;
};


Course.prototype.canBePicked = function(scheduleList) {
	for (var i = scheduleList.schedules.length - 1; i >= 0; i--) {
		var schedule = scheduleList.schedules[i];
		for (var j = this.courseOfferings.length - 1; j >= 0; j--) {
			var courseOffering = this.courseOfferings[j];
			if (courseOffering.fitsIn(schedule))
				return true;
		};
	};
	return false;
};

//Search filter
Course.prototype.matches = function(filter) {
	filter = filter || "";
	var strippedFilter = filter.replace(/\s/g, '');
	var strippedCourse = (this.id + this.name).replace(/\s/g, '');
	return strippedCourse.match(strippedFilter);
};


Schedule.prototype.canAddCourseOffering = function(newCourseOffering) {
	var termID = newCourseOffering.term.id

	if (!_.contains(this.getTermIDs(), termID)) {
		// console.log("Course offering is for a term that's not chosen")
		return false;
	};
	for (var i = this.courses[termID].length - 1; i >= 0; i--) {
		if(this.courses[termID][i].conflictsWith(newCourseOffering)) {
			// console.log("conflict")
			return false;
		};
	};
	// console.log("no conflict")


	if(this.constraint && !this.constraint.isSatisfiedBy(this.courses[termID].concat([newCourseOffering]))) {
		// console.log("constraint not satisfied");
		return false;
	}

	// console.log("no constraints violated")
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


Schedule.prototype.getFulfilledUnits = function(unitRequirement) {

	var requiredIds = unitRequirement.courseList.map(function(course){return course.id});

	var maxUnitsPerTerm;
	if (this.constraint) {
		maxUnitsPerTerm = this.constraint.maxUnitsPerTerm;
	};

	var unitsTowardsReq = 0;

	var termIDs = this.getTermIDs();

	for (var i = termIDs.length - 1; i >= 0; i--) {
		var termID = termIDs[i];
		var courseOfferings = this.courses[termID];
		var units = {};
		var unitsLeft = maxUnitsPerTerm || 24;
		for (var k = courseOfferings.length - 1; k >= 0; k--) {
			var courseOffering = courseOfferings[k];
			units[courseOffering.id] = courseOffering.units.min;
			unitsLeft -= units[courseOffering.id];
		};
		for (var j = courseOfferings.length - 1; j >= 0; j--) {
			var courseOffering = courseOfferings[j];
			if (_.contains(requiredIds, courseOffering.id)) {
				var addedUnits = Math.min(courseOffering.units.max - courseOffering.units.min, unitsLeft);
				units[courseOffering.id] += addedUnits;
				unitsTowardsReq += units[courseOffering.id];
				unitsLeft -= addedUnits;
			};
		};
	};

	return unitsTowardsReq ;
};

Schedule.prototype.fulfills = function(unitRequirement) {
	return this.getFulfilledUnits(unitRequirement) >= unitRequirement.requiredUnitCount;
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

//this also updates the fulfilled field in requirement
ScheduleList.prototype.fulfills = function(requirement) {
	switch (requirement.constructor.name){

		case "CourseRequirement":
			if (this.getScheduleCount() > 0){
				requirement.fulfilled = _.intersection(this.courses, requirement.courseList).length;
			}
			else{
				requirement.fulfilled = 0;
			}
			if( requirement.fulfilled < requirement.requiredCourseCount)
				return false;
			else
				return this.getScheduleCount() > 0;
			break;

		case "UnitRequirement":
			requirement.fulfilled = 0;
			for (var i = this.schedules.length - 1; i >= 0; i--) {
				var schedule = this.schedules[i];
				var fulfilled = schedule.getFulfilledUnits(requirement);
				if(fulfilled > requirement.fulfilled){
					requirement.fulfilled = fulfilled;
				}
			};
			if (requirement.fulfilled >= requirement.requiredUnitCount){
				return true;
			}
			else{
				return false;
			}
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
		this.terms = _.without(this.terms, this.terms[index]);
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
	this.required = this.requiredCourseCount || this.requiredUnitCount;
	this.courseList = courseList;
	this.fulfilled = 0;
}

function CourseRequirement(name, courseCount, courseList){
	Requirement.call(this, name, courseCount, 0, courseList);
}

function UnitRequirement(name, unitCount, courseList){
	Requirement.call(this, name, 0, unitCount, courseList);
}

CourseRequirement.prototype.adjusted = function(waivedCourses, alreadyTakenCourses) {
	//may want to amke waive/no-waive a type in the requirement
	var allowsWaive = ! this.name.match(/Significant Implementation/);

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

CourseRequirement.prototype.progressText = function() {
	return this.fulfilled + " of " + this.required + " courses";
};

UnitRequirement.prototype.progressText = function() {
	return this.fulfilled + " of " + this.required + " units";
};

CourseRequirement.prototype.instructions = function() {
	return "Select " + this.required + " courses from the following list:";
};

UnitRequirement.prototype.instructions = function() {
	return "Select " + this.required + " units from the following list:";
};


function Constraint(maxUnitsPerTerm, maxDaysPerTerm, allowedDays){
	this.maxUnitsPerTerm = maxUnitsPerTerm || 18;
	this.maxDaysPerTerm = maxDaysPerTerm || 5;
	this.allowedDays = allowedDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
}

Constraint.prototype.isSatisfiedBy = function(courseOfferings) {
	var result = true;

	if (this.maxUnitsPerTerm > 0) {
		var minSum = 0;
		for (var i = courseOfferings.length - 1; i >= 0; i--) {
			minSum += courseOfferings[i].units.min;
		};
		result = result && (minSum <= this.maxUnitsPerTerm);
	};

	if (this.maxDaysPerTerm < 5 || this.allowedDays.length < 5) {
		var unionDays = [];
		for (var i = courseOfferings.length - 1; i >= 0; i--) {
			unionDays = _.union(unionDays, courseOfferings[i].days);
		};
		result = result && (unionDays.length <= this.maxDaysPerTerm);

		result = result && (_.difference(unionDays, this.allowedDays).length === 0);
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

Application.prototype.start = function() {
	console.log("Loading");

	this.initCourses(function(){
		this.initPrograms(function(){
			this.initScheduleList(function(){
				console.log("Done Loading");
				this.loaded = true;
				this.run();
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
	return this.scheduleList.getCourses();
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

Application.prototype.removeWaivedCourse = function(course) {
	if(!_.contains(this.waivedCourses, course)){
		console.log("Error: Course not found in waived courses: " + course.id);
	}
	else{
		this.waivedCourses = _.without(this.waivedCourses, course);
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

Application.prototype.getAlreadyTakenUnits = function(course) {
	var alreadyTakenCourse = _.find(this.alreadyTakenCourses, function(c){return c.course === course});
	return alreadyTakenCourse.units;
};

Application.prototype.setAlreadyTakenUnits = function(course, units) {
	var alreadyTakenCourse = _.find(this.alreadyTakenCourses, function(c){return c.course === course});
	alreadyTakenCourse.units = units;
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

Application.prototype.removeAlreadyTakenCourse = function(course) {
	var alreadyTakenCourse = _.find(this.alreadyTakenCourses, function(c){return c.course === course});
	if(! alreadyTakenCourse){
		console.log("Error: course not marked as already taken");
	}
	else{
		this.alreadyTakenCourses = _.without(this.alreadyTakenCourses, alreadyTakenCourse);
	}
};

Application.prototype.fulfills = function(requirement) {
	var adjustedRequirement = requirement.adjusted(this.waivedCourses, this.alreadyTakenCourses);
	var res = this.scheduleList.fulfills(adjustedRequirement);
	requirement.fulfilled = adjustedRequirement.fulfilled + requirement.required - adjustedRequirement.required;
	return res;
};



function SingleDepthSpecialization(program) {
	this.singleDepth = program;
}

SingleDepthSpecialization.prototype.getRequirements = function() {
	return this.singleDepth.singleDepthReqs;
};

SingleDepthSpecialization.prototype.getBreadthRequirement = function() {
	return this.singleDepth.singleDepthReqs.filter(function(req){
		return req.name === 'Breadth';
	})[0];
};

SingleDepthSpecialization.prototype.getDepthRequirements = function() {
	return this.singleDepth.singleDepthReqs.filter(function(req){
		return req.name !== 'Breadth';
	});
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

Application.prototype.run = function() {

	if (!this.loaded) {
		console.log("Error: data not loaded");
		return;
	};
	console.log("Application starting!");


	var constraint = new Constraint(10, 3);
	this.setConstraint(constraint);
	this.setSpecialization(new SingleDepthSpecialization(this.getPrograms()[0]));

	ui.app = this;
	ui.activeRequirement = this.totalUnitRequirement;

	ui.renderRequirements();
	ui.renderCourses();
	ui.renderTerms();
	ui.renderConstraint();
	ui.renderSearch();
	ui.renderHeader();
	
};

var ui = {

	terms: [ new Term('Autumn', '2012-2013'), new Term('Winter', '2012-2013'), new Term('Spring', '2012-2013'),
				  new Term('Autumn', '2013-2014'), new Term('Winter', '2013-2014'), new Term('Spring', '2013-2014')],

	app: null,
	activeRequirement: null, //selected requirement in UI

	updateRequirements: function(){
		ui.app.getRequirements().forEach(function(req){
			ui.app.fulfills(req);
		});
	},

	renderRequirements: function(){
		$('#req-list li').remove();

		//overview
		var overviewReqView = new ui.RequirementView({requirement: app.totalUnitRequirement, label: 'Overview', indent: 0});
		$('#req-list').append(overviewReqView.render().el);

		//Foundations
		var foundationsReqView = new ui.RequirementView({requirement: app.foundationsRequirement, label: 'Foundations', indent: 1});
		$('#req-list').append(foundationsReqView.render().el);

		//SI
		var significantImplementationReqView = new ui.RequirementView({requirement: app.significantImplementationRequirement, label: 'Significant Implementation', indent: 1});
		$('#req-list').append(significantImplementationReqView.render().el);

		//Depth
		var depthReqs = ui.app.getSpecialization().getDepthRequirements();
		var summaryReq = depthReqs[depthReqs.length -1];
		var depthReqView = new ui.RequirementView({requirement: summaryReq, label: 'Depth', indent: 1});
		$('#req-list').append(depthReqView.render().el);

		depthReqs.forEach(function(req){
			var reqView = new ui.RequirementView({requirement: req, label: req.name, indent: 2});
			$('#req-list').append(reqView.render().el);
		});

		//Breadth
		var breadthReqView = new ui.RequirementView({requirement: ui.app.getSpecialization().getBreadthRequirement(), label: 'Breadth', indent: 1});
		$('#req-list').append(breadthReqView.render().el);

		//Electives
		var electivesReqView = new ui.RequirementView({requirement: app.totalUnitRequirement, label: 'Electives'});
		$('#req-list').append(electivesReqView.render().el);
	},

	renderCourses: function(){
		var filter = $('#search-box').val();
		$('#course-table tr').remove();
		$('#course-table').append('<tr><td colspan="4">' + ui.activeRequirement.instructions()+ '</td></tr>')
		ui.activeRequirement.courseList.forEach(function(course){
			if(course.matches(filter)){
				var courseView = new ui.CourseView({course: course});
				$('#course-table').append(courseView.render().el);
			}
		})
	},

	renderTerms: function(){
		ui.terms.forEach(function(term){
			var termView = new ui.TermView({term: term});
			$('#term-list').append(termView.render().el);
		});
	},

	renderConstraint: function(){
		var constraintView = new ui.ConstraintView();
		$('#constraint').append(constraintView.render().el);
	},

	renderSearch: function(){
		var searchView = new ui.SearchView();
		$('#search').html(searchView.render().el);
	},

	renderHeader: function(){
		var headerView = new ui.HeaderView();
		$('header').html(headerView.render().el);
	},

	Requirement: Backbone.Model.extend({
		name: 'default name'
	}),

	RequirementList: Backbone.Collection.extend({
		model: Requirement
	}),

	RequirementView: Backbone.View.extend({

		defaults: {
			label: "Default Label"
		},

		initialize: function(){
			this.label = this.options.label;
			this.requirement = this.options.requirement;
			this.indent = this.options.indent;
		},

		label: null,
		requirement: null,


		tagName: 'li',
		className: 'requirement',
		template: _.template("<ul><li class='req-label'></li><li class='progress-text'></li><li class='progress-bar'><meter min='0'></meter></li></ul>"),

		activate: function(){
			console.log('activate');
			ui.activeRequirement = this.requirement;
			ui.renderRequirements();
			ui.renderCourses();
		},

		events: {
			"click": "activate",
		},


		render: function(){
			this.$el.html(this.template());
			this.$el.toggleClass('activeReq', this.requirement === ui.activeRequirement);
			this.$('.req-label').html(this.label);
			this.$('.progress-text').html(this.requirement.progressText());
			this.$('meter').attr('max', this.requirement.required)
						   .attr('value', this.requirement.fulfilled);
			this.$('ul').css('padding-left', (this.indent * 20 + 20) + 'px');
			return this;
		}
	}),

	CourseView: Backbone.View.extend({
		initialize: function(){
			this.course = this.options.course;
		},

		tagName: 'tr',
		className: 'course',
		template: _.template("<td class='course-id'></td>"
							+"<td class='course-name'></td>"
							+"<td class='course-units'></td>"
							+"<td><ul>"
							+"<li><input type='checkbox' class='course-pick'>Pick</input></li>"
							+"<li><input type='checkbox' class='course-waive'>Waive</input></li>"
							+"<li><input type='checkbox' class='course-alreadyTaken'>Already taken <span class='unit-option' style='display:none'>for <input type='number' class='alreadyTaken-units' value='3'/> units </span></input></li>"
							+"</ul></td>"
							),

		events: {
			'click .course-waive' : 'toggleWaive',
			'click .course-alreadyTaken': 'toggleAlreadyTaken',
			'click .course-pick': 'togglePick',
			'input .alreadyTaken-units': 'updateTakenUnits'
		},

		toggleWaive: function(){
			console.log('waive')
			if (this.course.waived) {
				this.course.waived = false;
				ui.app.removeWaivedCourse(this.course);
			}
			else{
				this.course.waived = true;
				ui.app.addWaivedCourse(this.course);

				if(this.course.pick){
					this.course.pick = false;
					this.$('.course-pick').attr('checked', false);
					ui.app.removeCourse(this.course);
				};
				if (this.course.alreadyTaken) {
					this.course.alreadyTaken = false;
					this.$('.course-alreadyTaken').attr('checked', false);
					this.$('.unit-option').hide();
					ui.app.removeAlreadyTakenCourse(this.course);
				};
			}
			ui.updateRequirements();
			ui.renderRequirements();
			ui.renderCourses();
		},

		toggleAlreadyTaken: function(){
			console.log('already taken')
			if (this.course.alreadyTaken) {
				this.course.alreadyTaken = false;
				this.$('.unit-option').hide();
				ui.app.removeAlreadyTakenCourse(this.course);
			}
			else{
				this.course.alreadyTaken = true;
				this.$('.unit-option').show();

				ui.app.addAlreadyTakenCourse(this.course, parseInt(this.$('.alreadyTaken-units').val(),10));

				if(this.course.pick){
					this.course.pick = false;
					this.$('.course-pick').attr('checked', false);
					ui.app.removeCourse(this.course);
				};
				if(this.course.waived){
					this.course.waived = false;
					this.$('.course-waive').attr('checked', false);
					ui.app.removeWaivedCourse(this.course);
				};
			}
			ui.updateRequirements();
			ui.renderRequirements();
			ui.renderCourses();
		},

		togglePick: function(){
			if (this.course.pick) {
				this.course.pick = false;
				ui.app.removeCourse(this.course);
			}
			else{
				this.course.pick = true;
				ui.app.addCourse(this.course);

				if (this.course.alreadyTaken) {
					this.course.alreadyTaken = false;
					this.$('.course-alreadyTaken').attr('checked', false);
					this.$('.unit-option').hide();
					ui.app.removeAlreadyTakenCourse(this.course);
				};
				if(this.course.waived){
					this.course.waived = false;
					this.$('.course-waive').attr('checked', false);
					ui.app.removeWaivedCourse(this.course);
				};
			}

			ui.updateRequirements();
			ui.renderRequirements();
			ui.renderCourses();
		},

		updateTakenUnits: function(){
			console.log('update units')
			ui.app.setAlreadyTakenUnits(this.course, parseInt(this.$('.alreadyTaken-units').val(),10));

			ui.updateRequirements();
			ui.renderRequirements();
			ui.renderCourses();
		},

		render: function(){
			this.$el.html(this.template());
			this.$('.course-id').html(this.course.id);
			this.$('.course-name').html(this.course.name);
			this.$('.course-units').html(this.course.units.min + '-' + this.course.units.max);
			this.$('.course-pick').prop('checked',this.course.pick);
			this.$('.course-waive').prop('checked',this.course.waived);
			this.$('.course-alreadyTaken').prop('checked',this.course.alreadyTaken);
			this.$('.unit-option').toggle(this.course.alreadyTaken);

			this.$('.alreadyTaken-units').attr('min', this.course.units.min);
			this.$('.alreadyTaken-units').attr('max', this.course.units.max);
			if(this.course.alreadyTaken){
				this.$('.alreadyTaken-units').val(ui.app.getAlreadyTakenUnits(this.course));
			}

			if (!(this.course.pick || this.course.alreadyTaken || this.course.waived)
				&& !ui.app.canPick(this.course))
			{
				this.$('.course-pick').prop('disabled',true);
				this.$('.course-waive').prop('disabled',true);
				this.$('.course-alreadyTaken').prop('disabled',true);
			}

			return this;
		}

	}),

	TermView: Backbone.View.extend({
		initialize: function(){
			this.term = this.options.term;
		},

		tagName: 'li',
		className: 'term',
		template: _.template("<li><input class='term-pick' type='checkbox'/><span class='term-name'><span></li>"),

		render: function(){
			this.$el.html(this.template());
			this.$('.term-name').html(this.term.period + " " + this.term.year);
			return this;
		},

		events: {
			'click .term-pick' : 'toggleTerm',
		},

		toggleTerm: function(){
			if (this.$('.term-pick').prop('checked')) {
				ui.app.addTerm(this.term);
			}
			else{
				ui.app.removeTerm(this.term);
			}
			ui.updateRequirements();
			ui.renderRequirements();
			ui.renderCourses();
		}

	}),

	ConstraintView: Backbone.View.extend({

		tagName: 'span',
		className: 'constraint',
		template: _.template("<div class='constraint-units'>Max units per term: <input type='number' value='10' id='constraint-units-selector'/></div><div class='constraint-days'>Max days per term: <input type='number' value='3' id='constraint-numdays-selector'/></div>" 
							 +"<div>Days Allowed</div>"
							 +"<ul>"
							 +"<li><input type='checkbox' class='day-checkbox' value='Mon' checked>Monday</input></li>"
							 +"<li><input type='checkbox' class='day-checkbox' value='Tue' checked>Tuesday</input></li>"
							 +"<li><input type='checkbox' class='day-checkbox' value='Wed' checked>Wednesday</input></li>"
							 +"<li><input type='checkbox' class='day-checkbox' value='Thu' checked>Thursday</input></li>"
							 +"<li><input type='checkbox' class='day-checkbox' value='Fri' checked>Friday</input></li>"
							 +"</ul>"),

		render: function(){
			this.$el.html(this.template());
			this.$('#constraint-units-selector').attr('value', ui.app.getConstraint().maxUnitsPerTerm)
			this.$('#constraint-numdays-selector').attr('value', ui.app.getConstraint().maxDaysPerTerm);
			return this;
		},

		events: {
			'input #constraint-units-selector' : 'changeUnits',
			'input #constraint-numdays-selector' : 'changeNumDays',
			'click .day-checkbox': 'changeDays'
		},

		changeUnits: function(){
			var constraint = ui.app.getConstraint();
			constraint.maxUnitsPerTerm = parseInt(this.$('#constraint-units-selector').val(), 10);
			ui.app.setConstraint(constraint);

			ui.updateRequirements();
			ui.renderRequirements();
			ui.renderCourses();
		},

		changeNumDays: function(){
			var constraint = ui.app.getConstraint();
			constraint.maxDaysPerTerm = parseInt(this.$('#constraint-numdays-selector').val(), 10);
			ui.app.setConstraint(constraint);

			ui.updateRequirements();
			ui.renderRequirements();
			ui.renderCourses();
		},

		changeDays: function(){
			var constraint = ui.app.getConstraint();
			constraint.allowedDays = this.$('.day-checkbox:checked').map(function(i, el){
				return $(el).val();
			}).toArray();
			ui.app.setConstraint(constraint);

			ui.updateRequirements();
			ui.renderRequirements();
			ui.renderCourses();
		}

	}),

	SearchView: Backbone.View.extend({
		tagName: 'span',
		className: 'search',
		template: _.template("Search: <input type=text id='search-box' placeholder='enter class'/>"),

		render: function(){
			this.$el.html(this.template());
			return this;
		},

		events: {
			'input #search-box': 'handleInput',
		},

		handleInput: function(){
			ui.renderCourses();
		},

	}),

	HeaderView: Backbone.View.extend({
		tagName: 'div',
		className: 'header',
		template: _.template("<div id='select-program-tab' class='header-tab'>Select your program</div>"
							+"<div id='select-courses-tab' class='header-tab'>Select your courses</div>"
							+"<div id='view-schedules-tab' class='header-tab'>View Schedules</div>"),

		render: function(){
			this.$el.html(this.template());
			return this;
		},

		events: {
			'click #select-program-tab': 'selectProgram',
			'click #select-courses-tab': 'selectCourses',
			'click #view-schedules-tab': 'viewSchedules',
		},

		selectProgram: function(){
			console.log('clicked on select program tab')
		},

		selectCourses: function(){
			console.log('clicked on select courses tab')
		},

		viewSchedules: function(){
			console.log('clicked on view schedules tab')
		},
	})
}





var app = new Application();
app.start();

/* TODO
header
*/
