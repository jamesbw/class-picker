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

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function numToTime(num) {
	var ampm = num < 1200? "am": "pm";
	var hour = (Math.floor(num/100) - 1) % 12 + 1;
	var minutes = num % 100;
	var minuteStr = minutes > 10? ":"+minutes : (minutes > 0? ":0"+minutes : "");

	return hour + minuteStr + ampm;
}

function pluralize(str, count){
	return count + " " + (count === 1 ? str : str + 's');
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

function termIDtoTerm(id){
	var regexp = id.match(/(\w*)(201.*)/);
	return new Term(regexp[1], regexp[2]);
}

function Schedule(terms, constraint) {
	this.constraint = constraint;
	// this.units = {};
	this.courses = {};

	for (var i = terms.length - 1; i >= 0; i--) {
		// this.units[terms[i].id] = { "min" : 0, "max" : 0};
		this.courses[terms[i].id] = [];
	};
}

Schedule.prototype.clone = function() {
	var newSchedule = new Schedule([], this.constraint);
	var termIDs = this.getTermIDs();
	for (var i = termIDs.length - 1; i >= 0; i--) {
		var termID = termIDs[i];
		// newSchedule.units[termID] = { min: this.units[termID].min, max: this.units[termID].max};
		newSchedule.courses[termID] = this.courses[termID].slice();
	};
	return newSchedule;
};

function CourseOffering(id, name, units, term, days, startTime, endTime) {
	this.id = id
	this.name = name
	this.units = units
	this.term = term
	this.days = days
	this.startTime = startTime
	this.endTime = endTime
}

CourseOffering.prototype.fitsInWithConflicts = function(schedule) {
	var canAdd = schedule.canAddCourseOfferingWithConflicts(this);
	return {
		fits: canAdd.canAdd,
		conflicts: canAdd.conflicts
	};
};

CourseOffering.prototype.fitsIn = function(schedule) {
	return this.fitsInWithConflicts(schedule).fits;
};

//checks intersection. attempt at optimizing because _.intersection seems slow
function daysInCommon(days1, days2){
	var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
	for (var i = days.length - 1; i >= 0; i--) {
		var day = days[i];
		if ( (days1.indexOf(day) >=0) && (days2.indexOf(day) >=0)) {
			return true;
		};
	};
	return false;
}

CourseOffering.prototype.conflictsWith = function(courseOffering) {

	//same term?
	if (courseOffering.term.id !== this.term.id)
		return false;

	//same days?
	// if (_.isEmpty(_.intersection(courseOffering.days, this.days)))
	if (! daysInCommon(courseOffering.days, this.days)) {
		return false;
	};

	//same time?
	if ((this.startTime < courseOffering.startTime || this.startTime >= courseOffering.endTime)
			&& (courseOffering.startTime < this.startTime || courseOffering.startTime >= this.endTime))		
		return false;

	return true;
};

function Course(id, name, instructors, desc, units, terms, courseOfferings) {
	this.id = id;
	this.name = name;
	this.instructors = instructors;
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


Course.prototype.canBePickedWithFeedback = function(scheduleList) {


	//if too many schedule, we'll just randomly sample
	var numSchedules = scheduleList.schedules.length;

	//no offerings
	if (_.isEmpty(this.courseOfferings)) {
		return {
			canBePicked: false,
			feedback: "This course is not offered."
		};
	};

	//no offerings in selected terms
	var selectedTermIDs = scheduleList.terms.get('id');
	if (this.getTerms().every(function(term){
		return selectedTermIDs.indexOf(term.id) < 0;
	})){
		return {
			canBePicked: false,
			feedback: "This course is not offered in the selected terms."
		};
	};

	//no offerings with matching days
	if (this.courseOfferings.every(function(off){
		return off.days.some(function(day){
			return scheduleList.constraint.allowedDays.indexOf(day) < 0;
		}); 
	})){
		return {
			canBePicked: false,
			feedback: "This course is not offered in the selected days."
		};
	};

	var conflicts = [];

	if (numSchedules < 500) {
		for (var i = scheduleList.schedules.length - 1; i >= 0; i--) {
			var schedule = scheduleList.schedules[i];
			for (var j = this.courseOfferings.length - 1; j >= 0; j--) {
				var courseOffering = this.courseOfferings[j];
				var fitsWithConflicts = courseOffering.fitsInWithConflicts(schedule);
				if (fitsWithConflicts.fits){
					return {
						canBePicked: true,
						feedback: ""
					};
				}
				else {
					conflicts = conflicts.concat(fitsWithConflicts.conflicts);
				}
			};
		};		
	}
	else {
		//we sample
		var numSamples = 1000;
		while (numSamples > 0) {
			var index = getRandomInt(0, numSchedules -1);
			var schedule = scheduleList.schedules[index];
			for (var j = this.courseOfferings.length - 1; j >= 0; j--) {
				var courseOffering = this.courseOfferings[j];
				var fitsWithConflicts = courseOffering.fitsInWithConflicts(schedule);
				if (fitsWithConflicts.fits){
					return {
						canBePicked: true,
						feedback: ""
					};
				}
				else {
					conflicts = conflicts.concat(fitsWithConflicts.conflicts);
				}
			};
			numSamples -=1;
		}
	}

	return {
		canBePicked: false,
		feedback: "Consider removing " + _.uniq(conflicts).join(', ')
	};
};

Course.prototype.canBePicked = function(scheduleList) {
	return this.canBePickedWithFeedback(scheduleList).canBePicked;
};

//Search filter
Course.prototype.matches = function(filter) {
	filter = filter || "";
	var strippedFilter = filter.replace(/\s/g, '');
	var strippedCourse = (this.id + this.name).replace(/\s/g, '');
	return strippedCourse.match(strippedFilter);
};


Schedule.prototype.canAddCourseOfferingWithConflicts = function(newCourseOffering) {
	var termID = newCourseOffering.term.id

	if (this.getTermIDs().indexOf(termID) < 0) {
		// console.log("Course offering is for a term that's not chosen")
		return {
			canAdd: false,
			conflicts: []
		};
	};
	for (var i = this.courses[termID].length - 1; i >= 0; i--) {
		if(this.courses[termID][i].conflictsWith(newCourseOffering)) {
			// console.log("conflict")
			return {
				canAdd: false,
				conflicts: [this.courses[termID][i].id]
			};
		};
	};
	// console.log("no conflict")


	if(this.constraint && !this.constraint.isSatisfiedBy(this.courses[termID].concat([newCourseOffering]))) {
		// console.log("constraint not satisfied");
		return {
			canAdd: false,
			conflicts: this.courses[termID].get('id')
		};
	}

	// console.log("no constraints violated")
	return {
		canAdd: true,
		conflicts: []
	};
};

Schedule.prototype.canAddCourseOffering = function(newCourseOffering) {
	return this.canAddCourseOfferingWithConflicts(newCourseOffering).canAdd;
};

Schedule.prototype.add = function(courseOffering) {
	var termID = courseOffering.term.id
	if (!_.contains(this.getTermIDs(), termID)) {
		console.log("Course offering is for a term that's not chosen. Have you called canAddCourseOffering first?")
		return ;
	};
	this.courses[termID].push(courseOffering)
	// this.units[termID].min += courseOffering.units.min
	// this.units[termID].max += courseOffering.units.max
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

	var foundationIds = ['CS 103', 'CS 107', 'CS 109', 'CS 110', 'CS 161'];

	//do some memoization:
	if (! unitRequirement.requiredIds) {
		unitRequirement.requiredIds =  unitRequirement.courseList.get('id');
	};
	var requiredIds = unitRequirement.requiredIds;

	if (! unitRequirement.requiredWithoutFoundations) {
		unitRequirement.requiredWithoutFoundations =  _.difference(requiredIds, foundationIds);
	};
	var requiredWithoutFoundations = unitRequirement.requiredWithoutFoundations;

	if (! unitRequirement.foundationsInterRequired) {
		unitRequirement.foundationsInterRequired =  _.intersection(requiredIds, foundationIds);
	};
	var foundationsInterRequired = unitRequirement.foundationsInterRequired;

	if (! unitRequirement.requiredWithoutFoundationsHash) {
		unitRequirement.requiredWithoutFoundationsHash = {};
		for (var i = requiredWithoutFoundations.length - 1; i >= 0; i--) {
			unitRequirement.requiredWithoutFoundationsHash[requiredWithoutFoundations[i]] = true;
		};
	};
	var foundationsInterRequired = unitRequirement.foundationsInterRequired;


	var maxUnitsPerTerm;
	if (this.constraint) {
		maxUnitsPerTerm = this.constraint.maxUnitsPerTerm;
	};

	var unitsTowardsReq = 0;

	//keep count of units towards foundation because we will cap these
	var foundationsTotal = 0;

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

		//reiterate over required courses - minus the foundations
		var reqOfferings = [];
		for (var j = courseOfferings.length - 1; j >= 0; j--) {
			var off = courseOfferings[j];
			if (unitRequirement.requiredWithoutFoundationsHash[off.id]) {
				reqOfferings.push(off);
			};
		};

		for (var j = reqOfferings.length - 1; j >= 0; j--) {
			var courseOffering = reqOfferings[j];
			var addedUnits = Math.min(courseOffering.units.max - courseOffering.units.min, unitsLeft);
			units[courseOffering.id] += addedUnits;
			unitsTowardsReq += units[courseOffering.id];
			unitsLeft -= addedUnits;
		};

		//reiterate over the required foundations
		var foundationsOfferings = [];
		for (var j = courseOfferings.length - 1; j >= 0; j--) {
			var off = courseOfferings[j];
			if (_.contains(foundationsInterRequired, off.id)) {
				foundationsOfferings.push(off);
			};
		};

		for (var j = foundationsOfferings.length - 1; j >= 0; j--) {
			var courseOffering = foundationsOfferings[j];
			var addedUnits = Math.min(courseOffering.units.max - courseOffering.units.min, unitsLeft);
			units[courseOffering.id] += addedUnits;
			unitsTowardsReq += units[courseOffering.id];
			unitsLeft -= addedUnits;
			foundationsTotal += units[courseOffering.id];
		};
	};


	//cap the number of foundations units
	return unitsTowardsReq  - Math.max(0, foundationsTotal - 10);
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
			course.pick = false;
			if (this.canPick(course)) {
				this.addCourse(course);
			};
		}, this)
	};
}

ScheduleList.prototype.getScheduleCount = function() {
	return this.schedules.length;
};

ScheduleList.prototype.canPick = function(course) {
	return course.canBePicked(this);
};

ScheduleList.prototype.canPickWithFeedback = function(course) {
	var canBePicked = course.canBePickedWithFeedback(this);
	return {
		canPick: canBePicked.canBePicked,
		feedback: canBePicked.feedback
	};
};

ScheduleList.prototype.addCourse = function(course) {
	course.pick = true;
	var newSchedules = [];

	//if too many schedules, we just sample (without replacement)
	var numSchedules = this.schedules.length;

	if (numSchedules > 1000) {
		var sample = 0;
		var numSamples = 1000;
		while (sample < numSamples){
			var index = Math.floor( sample * (numSchedules - 1) / (numSamples - 1));
			var schedule = this.schedules[index];
			for (var i = course.courseOfferings.length - 1; i >= 0; i--) {
				var courseOffering = course.courseOfferings[i];
				if (schedule.canAddCourseOffering(courseOffering)) {
					var newSchedule = schedule.clone();
					newSchedule.add(courseOffering);
					newSchedules.push(newSchedule);
				};
			};
			sample +=1;
		}
	}
	else {
		for (var i = this.schedules.length - 1; i >= 0; i--) {
			var schedule = this.schedules[i];
			for (var j = course.courseOfferings.length - 1; j >= 0; j--) {
				var courseOffering = course.courseOfferings[j];
				if (schedule.canAddCourseOffering(courseOffering)) {
					var newSchedule = schedule.clone();
					newSchedule.add(courseOffering);
					newSchedules.push(newSchedule);
				};
			};
		};
	}

	this.courses.push(course);

	this.schedules = newSchedules
	console.log(newSchedules.length)
};

ScheduleList.prototype.removeCourse = function(course) {
	course.pick = false;
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

			//let's sample all schedules and get the max units from the sample
			if (this.getScheduleCount() > 100){
				var numSamples = 100;
				while (numSamples > 0){
					var index = getRandomInt(0, this.schedules.length -1);
					var schedule = this.schedules[index];
					var fulfilled = schedule.getFulfilledUnits(requirement);
					if(fulfilled > requirement.fulfilled){
						requirement.fulfilled = fulfilled;
					}
					numSamples -= 1;
				}
			}
			else {
				for (var i = this.schedules.length - 1; i >= 0; i--) {
					var schedule = this.schedules[i];
					var fulfilled = schedule.getFulfilledUnits(requirement);
					if(fulfilled > requirement.fulfilled){
						requirement.fulfilled = fulfilled;
					}
				};
			}


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
	return this.fulfilled + " of " + pluralize('course', this.required);
};

UnitRequirement.prototype.progressText = function() {
	return this.fulfilled + " of " + pluralize('unit', this.required);
};

CourseRequirement.prototype.instructions = function() {
	return "Click to select " + pluralize('course', this.required) + " from the following list";
};

UnitRequirement.prototype.instructions = function() {
	return "Click to select " + pluralize('unit', this.required) + " from the following list";
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
			var instructors = c.instructors;
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
				instructors,
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

Application.prototype.canPickWithFeedback = function(course) {
	return this.scheduleList.canPickWithFeedback(course);
};


Application.prototype.setWaivedCourses = function(courses) {
	this.waivedCourses = courses;
};

Application.prototype.getWaivedCourses = function() {
	return this.waivedCourses;
};

Application.prototype.addWaivedCourse = function(course) {
	course.waived = true;
	if(_.contains(this.waivedCourses, course)){
		console.log("Error: course already waived");
	}
	else{
		this.waivedCourses.push(course);
	}
};

Application.prototype.removeWaivedCourse = function(course) {
	course.waived = false;
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
	course.alreadyTaken = true;
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
	course.alreadyTaken = false;
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

Application.prototype.getSchedulesMeetingReqs = function(num) {

	var unitReqs = [];
	var courseReqs = [];
	for (var i = this.activeRequirements.length - 1; i >= 0; i--) {
		var req = this.activeRequirements[i];
		switch (req.constructor.name) {
			case  "UnitRequirement":
				unitReqs.push(req);
				break;
			case "CourseRequirement":
				courseReqs.push(req);
				break;
			default:
				console.log("Error: unknown requirement type")
		}
	};

	//if the course reqs are not fulfilled, then no schedule works
	for (var i = courseReqs.length - 1; i >= 0; i--) {
		var courseReq = courseReqs[i];
		if(!this.fulfills(courseReq)){
			return [];
		}
	};

	//now go through the unit reqs
	num = num || Infinity;
	var count = 0;
	var res = [];
	for (var i = this.getSchedules().length - 1; i >= 0; i--) {
		var schedule = this.getSchedules()[i];
		schedule.valid = unitReqs.every(function(req){return schedule.fulfills(req)});
		if (schedule.valid) {
			res.push(schedule);
			count +=1;
			if (count >= num) {
				break;
			};
		};
	};
	return res;
};

Application.prototype.run = function() {

	if (!this.loaded) {
		console.log("Error: data not loaded");
		return;
	};
	console.log("Application starting!");


	var constraint = new Constraint(10, 5);
	this.setConstraint(constraint);
	this.setSpecialization(new SingleDepthSpecialization(this.getPrograms()[0]));
	this.setTerms(ui.terms);

	this.addCourseByID('CS 103');
	this.addCourseByID('CS 107');
	this.addCourseByID('CS 109');
	this.addCourseByID('CS 110');
	this.addCourseByID('CS 161');
	this.addCourseByID('CS 221');
	this.addCourseByID('CS 223A');
	this.addCourseByID('CS 224M');
	this.addCourseByID('CS 224N');
	this.addCourseByID('CS 229');
	this.addCourseByID('CS 231A');
	this.addCourseByID('CS 124');
	this.addCourseByID('CS 224U');
	this.addCourseByID('CS 224W');
	this.addCourseByID('CS 228');
	this.addCourseByID('CS 140');
	this.addCourseByID('CS 143');
	this.addCourseByID('CS 144');

	ui.app = this;
	ui.activeRequirement = this.totalUnitRequirement;

	ui.renderHeader();
	ui.toggleContainers();

	ui.updateRequirements();
	ui.renderRequirements();
	ui.renderCourses();
	ui.toggleCourses();
	ui.renderTerms();
	ui.renderConstraint();
	ui.renderSearch();

	ui.renderPrograms();
	ui.renderSchedules(10);	
};

var ui = {

	terms: [ new Term('Autumn', '2012-2013'), new Term('Winter', '2012-2013'), new Term('Spring', '2012-2013'),
				  new Term('Autumn', '2013-2014'), new Term('Winter', '2013-2014'), new Term('Spring', '2013-2014')],

	app: null,
	activeRequirement: null, //selected requirement in UI
	activeTabId: 'select-program-tab',


	updateRequirements: function(){
		// return;
		ui.app.getRequirements().forEach(function(req){
			ui.app.fulfills(req);
		});
	},

	//enable, disable courses
	toggleCourses: function(tighter){

		var selectableOnly = $('#selectable-checkbox').prop('checked');

		if(tighter){
			$('#alert-area').children().remove();
			$("#alert-area").append($("<div class='alert-message alert fade in' data-alert><p> Warning: some classes may have been dropped to satisfy tighter constraints </p></div>"));
		    $(".alert-message").delay(2000).fadeOut("slow", function () { $(this).remove(); });
		};

		var courses = ui.activeRequirement.courseList;
		for (var i = courses.length - 1; i >= 0; i--) {
			var course = courses[i];
			var view = course.view;

			view.$el.toggleClass('picked', course.pick);
			view.$el.toggleClass('waived', course.waived);
			view.$el.toggleClass('already-taken', course.alreadyTaken);

			var canPickWithFeedback = ui.app.canPickWithFeedback(course);

			if (!(course.pick || course.alreadyTaken || course.waived)
				&& !canPickWithFeedback.canPick)
			{
				view.$el.addClass('disabled');
				view.$('.course-pick').prop('disabled',true);
				view.$('.label-disabled').show();	
				// view.$('.tooltip-content').text(canPickWithFeedback.feedback);
				view.$('.label-disabled').attr('data-original-title', canPickWithFeedback.feedback);
				view.$el.toggle(!selectableOnly);
			}
			else{
				view.$el.show();
				view.$el.removeClass('disabled');
				view.$('.label-disabled').hide();
				view.$('.course-pick').prop('disabled',false);
				view.$('.label-disabled').removeAttr('data-original-title');
				// view.$('.tooltip-content').text('');
			}
		};
	},

	toggleContainers: function(){
		$('.container').hide();
		$('.nav li').removeClass('active');
		switch(ui.activeTabId){
			case 'select-program-tab':
				$('#select-program-container').show();
				$('#select-program-tab').addClass('active');
				break;
				
			case 'select-courses-tab':
				$('#select-courses-container').show();
				$('#select-courses-tab').addClass('active');
				break;
			
			case 'view-schedules-tab':
				$('#view-schedules-container').show();
				$('#view-schedules-tab').addClass('active');
				break;
			default:
				console.log('Why not:' + ui.activeTabId)
		}
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
		// $('#course-table tr').remove();
        $('#course-table div').remove();
		$('#course-table').append('<div class="instructions well"><h4>' + ui.activeRequirement.instructions()+ '</h4></div>')
		ui.activeRequirement.courseList.forEach(function(course){
			if(course.matches(filter)){
				var courseView = new ui.CourseView({course: course});
				$('#course-table').append(courseView.render().el);
			}
		});
		// ui.toggleCourses();
	},

	renderTerms: function(){
		ui.terms.forEach(function(term){
			var termView = new ui.TermView({term: term});
			$('#terms').append(termView.render().el);
		});
	},

	renderConstraint: function(){
		var constraintView = new ui.ConstraintView();
		$('#constraint').append(constraintView.render().el);
	},

	renderSearch: function(){
		var searchView = new ui.SearchView();
		$('#search .navbar-inner').html(searchView.render().el);
	},

	renderHeader: function(){
		var headerView = new ui.HeaderView();
		$('header').html(headerView.render().el);
	},

	renderPrograms: function(){
		$('#programs').children().remove();
		ui.app.getPrograms().forEach(function(program){
			var programView = new ui.ProgramView({program: program});
			$('#programs').append(programView.render().el);
		});
	},

	renderSchedules: function(numToShow){
		$('#schedules').children().remove();

		//don't show any schedules if no courses are picked
		//this case is necessary because we start with an empty schedule
		if (_.isEmpty(ui.app.getCourses())) {
			$('#schedules').append("<div class='alert'>Pick some classes first!</div>");
			return;
		};

		numToShow = numToShow || 10;
		$('#schedules').append("<div class='alert alert-info'>Click on any term for a more detailed view</div>");
		var schedules = ui.app.getSchedulesMeetingReqs(numToShow);
		if (_.isEmpty(schedules)) {
			schedules = ui.app.getSchedules().slice(0,numToShow);
			$('#schedules').append("<div class='alert'>Warning: these schedules do not meet all the requirements</div>");
		};

        var newdiv;
        
		schedules.forEach(function(schedule, i){
            console.log(schedule)
			var scheduleView = new ui.ScheduleView({schedule: schedule, num: i+1});
            if (i%3 === 0) {
                newdiv = $("<div class='row'>");
                $('#schedules').append(newdiv);
            }
            newdiv.append(scheduleView.render().el);
		});

		$('.mini-term-schedule').overlay();
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
		// template: _.template("<ul><li class='req-label'></li><li class='progress-text'></li><li class='progress-bar'><meter min='0'></meter></li></ul>"),
		template: _.template("<a>"
                            +"  <p class='req-label'></p>"
                            +"  <div class='progress'>"
                            +"      <p class='progress-text'></p>"
                            +"      <div class='bar'></div>"
                            +"  </div>"
                            +"</a>"),

		activate: function(){
			ui.activeRequirement = this.requirement;
			ui.renderRequirements();
			ui.renderCourses();
			ui.toggleCourses();
		},

		events: {
			"click": "activate",
		},


		// render: function(){
		// 	this.$el.html(this.template());
		// 	this.$el.toggleClass('activeReq', this.requirement === ui.activeRequirement);
		// 	this.$('.req-label').html(this.label);
		// 	this.$('.progress-text').html(this.requirement.progressText());
		// 	this.$('meter').attr('max', this.requirement.required)
		// 				   .attr('value', this.requirement.fulfilled);
		// 	this.$('ul').css('padding-left', (this.indent * 20 + 20) + 'px');
		// 	return this;
		// }

        render: function(){
            progressValue = this.requirement.fulfilled / this.requirement.required * 100;
            this.$el.html(this.template());
            this.$el.toggleClass('active', this.requirement === ui.activeRequirement);
            this.$el.addClass('level-' + this.indent);
            this.$('.req-label').html(this.label);
            this.$('.progress-text').html(this.requirement.progressText());
            this.$('.bar').css('width', progressValue + '%');
            if (progressValue <= 50) {
                this.$('.progress').addClass('progress-danger');
            }
            else if (progressValue < 100) {
                this.$('.progress').addClass('progress-warning');
            }
            else {
                this.$('.progress').addClass('progress-success');
            };
            return this;
        }
	}),

	CourseView: Backbone.View.extend({
		initialize: function(){
			this.course = this.options.course;
		},

		// tagName: 'tr',
		// className: 'course',
		// template: _.template("<td class='course-id'></td>"
		// 					+"<td class='course-name'></td>"
		// 					+"<td class='course-units'></td>"
		// 					+"<td class='tooltip-content'></td>"
		// 					+"<td><ul>"
		// 					+"<li><input type='checkbox' class='course-pick'>Pick</input></li>"
		// 					+"<li><input type='checkbox' class='course-waive'>Waive</input></li>"
		// 					+"<li><input type='checkbox' class='course-alreadyTaken'>Already taken <span class='unit-option' style='display:none'>for <input type='number' class='alreadyTaken-units' value='3'/> units </span></input></li>"
		// 					+"</ul></td>"
		// 					),

        tagName: 'div',
        className: 'course well',
        template: function(){
        	var randomInt = getRandomInt(0,1000000);
        	return _.template("<div class='course-content'>"
                            +"  <table>"
                            +"      <tr>"
                            +"          <td class='course-id'></td>"
                            +"          <td class='course-name'>"
                            +"              <div class='label-container'>"
                            +"                  <span class='course-label label-disabled label label-important'>Not selectable</span>"
                            +"                  <span class='course-label label-waived label'>Waived</span>"
                            +"                  <span class='course-label label-already-taken label label-info'>Already Taken</span>"
                            +"              </div>"
                            +"          </td>"
                            +"          <td class='course-units'></td>"
                            +"      </tr>"
                            +"  </table>"
                            +"</div>"
                            +"<div class='course-options'>"
                            +"  <table>"
                            +"      <tr>"
                            +"          <td class='more-info' data-toggle='modal' data-target='#info-modal-"+randomInt+"'>more info</td>"
                            +"			<div id='info-modal-" + randomInt + "' class='modal hide fade' tabindex='-1' role='dialog' aria-labelledby='myModalLabel' aria-hidden='true'></div>"
                            +"      </tr>"
                            +"      <tr>"
                            +"          <td class='more-options'>more options</td>"
                            +"      </tr>"
                            +"  </table>"
                            +"</div>"
                         )},

		events: {
			'click .course-waive' : 'toggleWaive',
			'click .course-alreadyTaken': 'toggleAlreadyTaken',
			'click .course-content': 'togglePick',
			'input .alreadyTaken-units': 'updateTakenUnits',
		},

		toggleWaive: function(){
			console.log('waive')
			if (this.course.waived) {
				this.$('.label-waived').hide();
				this.course.waived = false;
				ui.app.removeWaivedCourse(this.course);
			}
			else{
				this.course.waived = true;
				ui.app.addWaivedCourse(this.course);
				this.$('.label-waived').show();

				if(this.course.pick){
					this.course.pick = false;
					this.$('.course-pick').attr('checked', false);
					ui.app.removeCourse(this.course);
				};
				if (this.course.alreadyTaken) {
					this.$('.label-already-taken').hide();
					this.course.alreadyTaken = false;
					this.$('.course-alreadyTaken').attr('checked', false);
					this.$('.unit-option').hide();
					ui.app.removeAlreadyTakenCourse(this.course);
				};
			}
			ui.updateRequirements();
			ui.renderRequirements();
			// ui.renderCourses();
			ui.toggleCourses();
		},

		toggleAlreadyTaken: function(){
			console.log('already taken')
			if (this.course.alreadyTaken) {
				this.course.alreadyTaken = false;
				// this.$('.unit-option').hide();
				ui.app.removeAlreadyTakenCourse(this.course);
				this.$('.label-already-taken').hide();
			}
			else{
				this.$('.label-already-taken').show();
				this.course.alreadyTaken = true;
				// this.$('.unit-option').show();

				ui.app.addAlreadyTakenCourse(this.course, parseInt(this.$('.alreadyTaken-units').val(),10));

				if(this.course.pick){
					this.course.pick = false;
					// this.$('.course-pick').attr('checked', false);
					ui.app.removeCourse(this.course);
				};
				if(this.course.waived){
					this.$('.label-waived').hide();
					this.course.waived = false;
					this.$('.course-waive').attr('checked', false);
					ui.app.removeWaivedCourse(this.course);
				};
			}
			ui.updateRequirements();
			ui.renderRequirements();
			// ui.renderCourses();
			ui.toggleCourses();
		},

		togglePick: function(){

			// console.log(this.$el,this.$el.is('disabled'))
			if (this.$el.is('.disabled') || this.course.alreadyTaken || this.course.waived) {
				//can't pick disabled course
				//if waived or already taken, need to clear that first
				return;
			};

			if (this.course.pick) {
				this.course.pick = false;
				ui.app.removeCourse(this.course);
			}
			else{
				this.course.pick = true;
				ui.app.addCourse(this.course);

				if (this.course.alreadyTaken) {
					this.$('.label-already-taken').hide();
					this.course.alreadyTaken = false;
					this.$('.course-alreadyTaken').attr('checked', false);
					this.$('.unit-option').hide();
					ui.app.removeAlreadyTakenCourse(this.course);
				};
				if(this.course.waived){
					this.$('.label-waived').hide();
					this.course.waived = false;
					this.$('.course-waive').attr('checked', false);
					ui.app.removeWaivedCourse(this.course);
				};
			}

			ui.updateRequirements();
			ui.renderRequirements();
			// ui.renderCourses();
			ui.toggleCourses();
		},

		updateTakenUnits: function(){

			if (!this.course.alreadyTaken) {
				//nothing to update if the course hasn't been checked
				return;
			};
			console.log('update units')
			ui.app.setAlreadyTakenUnits(this.course, parseInt(this.$('.alreadyTaken-units').val(),10));

			ui.updateRequirements();
			ui.renderRequirements();
			// ui.renderCourses();
			ui.toggleCourses();
		},

		render: function(){
			this.course.view = this;
			this.$el.html(this.template());
			var that = this;
			this.$('.label-disabled').tooltip({
				// title: function(){console.log('called');return that.$('.tooltip-content').text()}
				placement: 'right'
			});
			this.$('.course-id').html(this.course.id);
			this.$('.course-name .label-container').before(this.course.name);


			var variableUnits = this.course.units.min !== this.course.units.max;
            var unitsNumber = (variableUnits ? (this.course.units.min + '-' + this.course.units.max) : this.course.units.min)
			var unitsText = unitsNumber === 1 ? "1 unit" : unitsNumber + " units";
			this.$('.course-units').html(unitsText);
			// this.$('.course-pick').prop('checked',this.course.pick);
			// this.$('.course-waive').prop('checked',this.course.waived);
			// this.$('.course-alreadyTaken').prop('checked',this.course.alreadyTaken);
			// this.$('.unit-option').toggle(this.course.alreadyTaken);
			// this.$('.tooltip-content').hide();
			

			var that = this;

			//render modal
			this.$('.modal').html("<div class='modal-header'>"
								 +"		<button type='button' class='close' data-dismiss='modal' aria-hidden='true'>&#x2a2f;</button>"
    							 +"		<h3 id='myModalLabel'>" + this.course.id + " " + this.course.name + "</h3>"
    							 +"</div>"
    							 +"<div class='modal-body'>"
    							 +"		<dl class='dl-horizontal'>"
    							 +"			<dt>Units</dt><dd>" + unitsNumber + "</dd>"
    							 +"			<dt>Description</dt><dd>" + this.course.desc + "</dd>"
    							 +"			<dt>Instructors</dt><dd>" + this.course.instructors.join(', ') + "</dd>"
    							 +"			<dt>Grading</dt><dd>" + "Letter or Credit/No Credit" + "</dd>"
                                 +"         <dt>Offered</dt>"
    							 + that.course.courseOfferings.map(function(off){
										return '<dd>' + off.term.period + " " + off.term.year + ": " + off.days.join('-') + " " + numToTime(off.startTime) + "-" + numToTime(off.endTime) + '</dd>';
									}).join('')
    							 +"		</dl>"
    							 +"</div>"
								 +"<div class='modal-footer'>"
								 +"		<button class='btn' data-dismiss='modal' aria-hidden='true'>Close</button>"
								 +"</div>");


			// this.$('.more-info').popover({
			// 	content: function(){

					// var items = that.course.courseOfferings.map(function(off){
					// 	return '<li>' + off.term.period + " " + off.term.year + ": " + off.days.join('-') + " " + numToTime(off.startTime) + "-" + numToTime(off.endTime) + '</li>';
					// }).join('');

			// 		return  that.course.desc + that.course.instructors.join(', ') +  "<ul>" + items + '</ul>';
			// 	},
			// 	html: true,
			// 	placement: 'right',
			// 	trigger: 'hover'
			// });

			this.$('.more-options').popover({
				html: true,
				placement: 'bottom',
                title: 'Check what applies',
				content:  function(){
					console.log(that.course)
					var units;
					if(that.course.alreadyTaken){
						units = ui.app.getAlreadyTakenUnits(that.course);
					}
					else {
						units = that.course.units.min;
					}

					var el = $("<label class='checkbox'><input type='checkbox' class='course-waive' " + (that.course.waived? "checked" : "") + "> I waived this course</input></label>"
	                            +"<label class='checkbox'><input type='checkbox' class='course-alreadyTaken' " + (that.course.alreadyTaken? "checked" : "") + ">"
	                            +" I already took this course"
	                            + (variableUnits? " for <input type='number' class='alreadyTaken-units' value='"+ units + "' min='"+ that.course.units.min + "' max='" + that.course.units.max + "'/> units </input>" : "")
	                            +"</label>"
                    );


					// el.select('.alreadyTaken-units').attr('min', that.course.units.min)
					// 								.attr('max', that.course.units.max);

					// el.select('.course-waive').prop('checked', that.course.waived);
					// el.select('.course-alreadyTaken').prop('checked', that.course.alreadyTaken);

					// that.$('.alreadyTaken-units').attr('min', that.course.units.min);
					// that.$('.alreadyTaken-units').attr('max', that.course.units.max);
					// if(that.course.alreadyTaken){
					// 	that.$('.alreadyTaken-units').val(ui.app.getAlreadyTakenUnits(that.course));
					// }
					// else {
					// 	that.$('.alreadyTaken-units').val(that.course.units.min);
					// }

					return el;

				}  

			})

			

			return this;
		}

	}),

	TermView: Backbone.View.extend({
		initialize: function(){
			this.term = this.options.term;
		},

		tagName: 'li',
		className: 'term',
		template: _.template("<a><label class='checkbox'><input class='term-pick' type='checkbox'><span class='term-name'><span></input></label></a>"),

		render: function(){
			this.$el.html(this.template());
			this.$('.term-name').html(this.term.period + " " + this.term.year);
			this.$('.term-pick').prop('checked', _.contains(ui.app.getTerms(),this.term));
			return this;
		},

		events: {
			'click .term-pick' : 'toggleTerm',
		},

		toggleTerm: function(){
			var added = this.$('.term-pick').prop('checked');
			if (added) {
				ui.app.addTerm(this.term);
			}
			else{
				ui.app.removeTerm(this.term);
			}
			ui.updateRequirements();
			ui.renderRequirements();
			// ui.renderCourses();
			ui.toggleCourses(!added);
		}

	}),

	ConstraintView: Backbone.View.extend({

		tagName: 'ul',
		className: 'constraint nav nav-list',
		template: _.template("<li class='constraint-units nav-header'>Max units per term:</li> <li><input type='number' value='10' id='constraint-units-selector' class='span1'/></li><li class='constraint-days nav-header'>Max days per week:</li> <li><input type='number' value='3' id='constraint-numdays-selector' class='span1'/></li>" 
							 +"<li class='nav-header'>Days Allowed</li>"
							 +"<li><a><label class='checkbox'><input type='checkbox' class='day-checkbox' value='Mon' checked>Monday</input></label></a></li>"
							 +"<li><a><label class='checkbox'><input type='checkbox' class='day-checkbox' value='Tue' checked>Tuesday</input></label></a></li>"
							 +"<li><a><label class='checkbox'><input type='checkbox' class='day-checkbox' value='Wed' checked>Wednesday</input></label></a></li>"
							 +"<li><a><label class='checkbox'><input type='checkbox' class='day-checkbox' value='Thu' checked>Thursday</input></label></a></li>"
							 +"<li><a><label class='checkbox'><input type='checkbox' class='day-checkbox' value='Fri' checked>Friday</input></label></a></li>"),

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
			var newMax = parseInt(this.$('#constraint-units-selector').val(), 10);
			var tighter = newMax < constraint.maxUnitsPerTerm;
			constraint.maxUnitsPerTerm = newMax;
			ui.app.setConstraint(constraint);

			ui.updateRequirements();
			ui.renderRequirements();
			// ui.renderCourses();
			ui.toggleCourses(tighter);
		},

		changeNumDays: function(){
			var constraint = ui.app.getConstraint();
			var newNum = parseInt(this.$('#constraint-numdays-selector').val(), 10);
			var tighter = newNum < constraint.maxDaysPerTerm;
			constraint.maxDaysPerTerm = newNum;
			ui.app.setConstraint(constraint);

			ui.updateRequirements();
			ui.renderRequirements();
			// ui.renderCourses();
			ui.toggleCourses(tighter);
		},

		changeDays: function(){
			var constraint = ui.app.getConstraint();
			var newDays = this.$('.day-checkbox:checked').map(function(i, el){
				return $(el).val();
			}).toArray();
			var tighter = newDays.length < constraint.allowedDays.length;
			constraint.allowedDays = newDays;
			ui.app.setConstraint(constraint);

			ui.updateRequirements();
			ui.renderRequirements();
			// ui.renderCourses();
			ui.toggleCourses(tighter);
		}

	}),

	SearchView: Backbone.View.extend({
		tagName: 'span',
		className: 'search',
		template: _.template("<form class='navbar-search'><input type='text' id='search-box' class='search-query' placeholder='search for a class'>"
							+"<input type='checkbox' id='selectable-checkbox' label='Restrict to selectable courses'>Restrict to selectable courses</input>"
							+"</form>"),

		render: function(){
			this.$el.html(this.template());
			return this;
		},

		events: {
			'input #search-box': 'handleInput',
			'click #selectable-checkbox': 'handleInput',
		},

		handleInput: function(){
			ui.renderCourses();
			ui.toggleCourses();
		},

	}),

	HeaderView: Backbone.View.extend({
		tagName: 'div',
		className: 'header',
		template: _.template("<div class='navbar navbar-fixed-top'>"
  							+"	<div class='navbar-inner'>"
  							+"		<ul class='nav'>"
							+"			<li id='select-program-tab' class='header-tab'><a><h4>1. Select your program</h4></a></li>"
							+"			<li id='select-courses-tab' class='header-tab'><a><h4>2. Select your courses</h4></a></li>"
							+"			<li id='view-schedules-tab' class='header-tab'><a><h4>3. View Schedules</h4></a></li>"
							+"		</ul>"
							+"  </div>"
							+"</div>"),

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
			console.log('clicked on select program tab');
			ui.activeTabId = 'select-program-tab';
			ui.toggleContainers();
		},

		selectCourses: function(){
			console.log('clicked on select courses tab')
			ui.activeTabId = 'select-courses-tab';
			ui.toggleContainers();
			ui.renderRequirements();
		},

		viewSchedules: function(){
			console.log('clicked on view schedules tab')
			ui.activeTabId = 'view-schedules-tab';
			ui.toggleContainers();
			ui.renderSchedules(10);
		},
	}),

	ProgramView: Backbone.View.extend({

		initialize: function(){
			this.program = this.options.program;
		},

		tagName: 'div',
		className: 'program',
		template: _.template("<h3 class='program-name'></h3>"
							+"<ul class='course-list'></ul>"),

		render: function(){
			this.$el.html(this.template());
			this.$('.program-name').html(this.program.name);
			this.program.depthCourses.slice(0,5).forEach(function(c){
				this.$('.course-list').append("<li>"+ c.id + " " + c.name + "</li>");
			}, this);
			if(this.program === ui.app.getSpecialization().singleDepth){
				this.$el.addClass('activeProgram');
			}
			return this;
		},

		events: {
			'click': 'selectProgram',
		},

		selectProgram: function(){
			ui.app.setSpecialization(new SingleDepthSpecialization(this.program));
			$('.program').removeClass('activeProgram');
			this.$el.addClass('activeProgram');
		}
	}),

	ScheduleView: Backbone.View.extend({
		initialize: function(){
			this.schedule = this.options.schedule;
			this.num = this.options.num;
		},

		tagName: 'div',
		className: 'schedule span4',
		template: _.template("<div class='schedule-container'><h4 class='schedule-title'><h4></div>"),

		render: function(){
			this.$el.html(this.template());
			this.$('.schedule-title').html("Schedule proposal #" + this.num);
			this.schedule.getTermIDs().forEach(function(termID){

				var term = termIDtoTerm(termID);

				var courses = '<ul>';
                this.schedule.courses[termID].get('id').forEach( function(item) {
                    courses += '<li>'+ item + '</li>';
                });
                courses += '</ul>'
                // this.schedule.courses[termID].get('id').join(', ');

				var uniqueID = termID + getRandomInt(0, 10000000);

				this.$('.schedule-container').append("<div class='schedule-term " + termID + "'>"
                                                    +"  <p class='nav-header'>" + term.period + " " + term.year + "</p>"
                                                    +"  <div class='row'>"
                                                    // +"      <div class='mini-term-schedule span2' rel='#" + uniqueID + "'></div>"
                                                    +"      <a class='mini-term-schedule span2' role='button' data-toggle='modal' href='#" + uniqueID + "'></a>"
                                                    +"      <div class='course-list span2'>" + courses + "</div>"
                                                    +"  </div>"
                                                    // +"  <div class='schedule-overlay' id='"+ uniqueID+"'></div>"
                                                    +"  <div id='" + uniqueID + "' class='modal hide fade schedule-overlay' tabindex='-1' role='dialog' aria-labelledby='myModalLabel' aria-hidden='true'>"
                                                    +"      <div class='modal-header'>"
                                                    +"          <button type='button' class='close' data-dismiss='modal' aria-hidden='true'>&times;</button>"
                                                    +"          <h3>" + termID + "</h3>"
                                                    +"      </div>"
                                                    +"      <div class='modal-body'></div>"
                                                    +"      <div class='modal-footer'>"
                                                    +"          <a href='#' class='btn btn-primary' data-dismiss='modal' aria-hidden='true'>Close</a>"
                                                    +"      </div>"
                                                    +"  </div>"
                                                    +"</div>");

				var svgHeight = 70;
				var svgWidth = 140;
				// this.$('.'+termID ).width(svgWidth)
				var svg = d3.select(this.$('.'+termID+ ' .mini-term-schedule')[0])
							.append('svg')
							.attr('width', svgWidth)
							.attr('height', svgHeight);

				var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

				svg.selectAll('rect .svg-day')
					.data(days)
					.enter()
					.append('rect')
					.classed('svg-day', true)
					.attr('x', function(d,i){return svgWidth / 5 * i})
					.attr('width', svgWidth / 5)
					.attr('y', 0)
					.attr('height', svgHeight)


				var courseOfferings = this.schedule.courses[termID];
				var slots = [];
				for (var i = courseOfferings.length - 1; i >= 0; i--) {
					var courseOffering = courseOfferings[i];
					for (var j = courseOffering.days.length - 1; j >= 0; j--) {
						var day = courseOffering.days[j]
						slots.push({
							courseNum: i,
							courseID: courseOffering.id,
							day: day,
							start: courseOffering.startTime,
							end: courseOffering.endTime
						});
					};
				};

				var timeScale = d3.scale.linear()
								  .domain([700, 2000])
								  .range([0, svgHeight])

				svg.selectAll('rect .svg-course')
					.data(slots)
					.enter()
					.append('rect')
					.classed('svg-course', true)
					.classed('course-1', function(d){return  d.courseNum === 0})
					.classed('course-2', function(d){return  d.courseNum === 1})
					.classed('course-3', function(d){return  d.courseNum === 2})
					.classed('course-4', function(d){return  d.courseNum === 3})
					.classed('course-5', function(d){return  d.courseNum === 4})
					.classed('course-6', function(d){return  d.courseNum === 5})
					.attr('x', function(d){return days.indexOf(d.day) * svgWidth / 5})
					.attr('y', function(d){return timeScale(d.start)})
					.attr('width', svgWidth / 5)
					.attr('height', function(d){return timeScale(d.end) - timeScale(d.start)})
					.attr('rx', 2)
					.attr('ry', 2)



				var overlaySVGWidth = 530;
				var overlaySVGHeight = 300;
				var margin = 0;

										
				var overlaySVG = d3.select(this.$('.'+termID+ ' .schedule-overlay .modal-body')[0])
							.append('svg')
							.attr('width', overlaySVGWidth + margin )
							.attr('height', overlaySVGHeight + margin);  
				
				var overlaySchedule = overlaySVG.append('g')
										.attr('transform','translate(' + margin + ',' + margin +')')

				overlaySchedule.selectAll('rect .svg-day')
					.data(days)
					.enter()
					.append('rect')
					.classed('svg-day', true)
					.attr('x', function(d,i){return overlaySVGWidth / 5 * i})
					.attr('width', overlaySVGWidth / 5)
					.attr('y', 0)
					.attr('height', overlaySVGHeight)

				var overlayTimeScale = d3.scale.linear()
								  .domain([700, 2000])
								  .range([0, overlaySVGHeight])

				overlaySchedule.selectAll('line .svg-hour-line')
				  	.data([900, 1200, 1500, 1800])
				  	.enter()
				  	.append('line')
				  	.classed('svg-hour-line', true)
				  	.attr('x1', 0)
				  	.attr('x2', overlaySVGWidth)
				  	.attr('y1', overlayTimeScale)
				  	.attr('y2', overlayTimeScale)
				  	.attr('stroke', '#EBEBEB')
				  	.attr('stroke-width', 1)

				overlaySchedule.selectAll('text .svg-time-label')
					.data([{text:'9am', num: 900}, {text:'12pm', num: 1200}, {text:'3pm', num: 1500}, {text:'6pm', num: 1800}])
					.enter()
					.append('text')
					.classed('svg-time-label', true)
					.attr('x', 0)
					.attr('y', function(d){return overlayTimeScale(d.num)})
					.attr('stroke', 'gray')
					.attr('font-size', 10)
					.attr('text-anchor', 'left')
					.text(function(d){ return d.text})

				overlaySchedule.selectAll('text .svg-day-label')
					.data(days)
					.enter()
					.append('text')
					.classed('svg-day-label', true)
					.attr('x', function(d,i){return (overlaySVGWidth / 5) * (i + 0.5)})
					.attr('y', 20)
					.attr('stroke', 'gray')
					.attr('stroke-width', 1)
					.attr('font-size', 10)
					// .attr('font-weight', 'bold')
					.attr('text-anchor', 'middle')
					.text(String)

				overlaySchedule.selectAll('rect .svg-course')
					.data(slots)
					.enter()
					.append('rect')
					.classed('svg-course', true)
					.classed('course-1', function(d){return  d.courseNum === 0})
					.classed('course-2', function(d){return  d.courseNum === 1})
					.classed('course-3', function(d){return  d.courseNum === 2})
					.classed('course-4', function(d){return  d.courseNum === 3})
					.attr('x', function(d){return days.indexOf(d.day) * overlaySVGWidth / 5})
					.attr('y', function(d){return overlayTimeScale(d.start)})
					.attr('width', overlaySVGWidth / 5)
					.attr('height', function(d){return overlayTimeScale(d.end) - overlayTimeScale(d.start)})
					.attr('rx', 5)
					.attr('ry', 5)

				overlaySchedule.selectAll('text .svg-course-label')
					.data(slots)
					.enter()
					.append('text')
					.classed('svg-course-label', true)
					.attr('x', function(d){return (days.indexOf(d.day) + 0.5) * overlaySVGWidth / 5})
					.attr('y', function(d){return (overlayTimeScale(d.end) + overlayTimeScale(d.start) + 10) / 2})
					.attr('stroke', 'white')
					.attr('font-size', 10)
					.attr('text-anchor', 'middle')
					// .style('font-weight', 'lighter')
					.text(function(d){ return d.courseID})



			}, this);
			return this;
		},


	})
}





var app = new Application();
app.start();

/* TODO
overview tabs
local storage
disable tooltip detail
select schedule
credit no-credit
singularize/pluralize
remove yellow from schedule colors
*/
